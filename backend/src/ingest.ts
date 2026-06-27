// Phase 2 — Gmail rate-con ingest worker.
//
// Polls every configured inbox, dedupes against the `emails` table (gmail_id is
// unique), runs each new candidate through the shared extractor, and — when it's
// a confident rate con — drops the load straight onto the board (source='email')
// and posts a note in Team chat. Every email it looks at is recorded so it is
// never reprocessed.

import { fileURLToPath } from "url";
import { q, pool } from "./db.js";
import { getAccounts, listCandidateIds, fetchMessage, ingestConfigured, type FetchedMessage } from "./gmail.js";
import { extractLoad, type ExtractedLoad } from "./extract.js";

const MIN_CONFIDENCE = parseFloat(process.env.GMAIL_MIN_CONFIDENCE || "0.6");

export interface IngestResult {
  ok: boolean;
  scanned: number; // candidate ids seen across all mailboxes
  fetched: number; // new messages actually fetched
  loadsAdded: number;
  skipped: number; // fetched but not a confident rate con
  errors: number;
  details: string[];
  ranAt: string;
}

let lastResult: IngestResult | null = null;
let lastRunAt: string | null = null;
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

export function getIngestStatus() {
  return {
    enabled: process.env.GMAIL_INGEST_ENABLED === "true",
    configured: ingestConfigured(),
    accounts: getAccounts().map((a) => a.email),
    minConfidence: MIN_CONFIDENCE,
    pollSeconds: Math.max(20, Math.round(parseInt(process.env.GMAIL_POLL_MS || "60000", 10) / 1000)),
    running,
    lastRunAt,
    lastResult,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function runIngestOnce(): Promise<IngestResult> {
  const result: IngestResult = {
    ok: true,
    scanned: 0,
    fetched: 0,
    loadsAdded: 0,
    skipped: 0,
    errors: 0,
    details: [],
    ranAt: new Date().toISOString(),
  };

  if (running) {
    result.ok = false;
    result.details.push("A run is already in progress.");
    return result;
  }
  running = true;

  try {
    const accounts = getAccounts();
    if (!accounts.length) {
      result.ok = false;
      result.details.push("No GMAIL_ACCOUNTS configured.");
      return result;
    }

    for (const account of accounts) {
      let ids: string[];
      try {
        ids = await listCandidateIds(account);
      } catch (e: any) {
        result.errors++;
        result.details.push(`[${account.email}] list failed: ${e.message}`);
        continue;
      }
      result.scanned += ids.length;
      if (!ids.length) continue;

      // Skip anything we've already recorded.
      const seen = await q(`select gmail_id from emails where gmail_id = any($1)`, [ids]);
      const seenSet = new Set(seen.map((r: any) => r.gmail_id));
      const newIds = ids.filter((id) => !seenSet.has(id));

      for (const id of newIds) {
        try {
          const msg = await fetchMessage(account, id);
          result.fetched++;

          let extracted: ExtractedLoad;
          try {
            extracted = await extractLoad({
              text: `Subject: ${msg.subject}\nFrom: ${msg.from}\n\n${msg.bodyText}`,
              pdfs: msg.pdfs,
            });
          } catch (e: any) {
            // Record it (with the error) so we don't retry it forever.
            await recordEmail(msg, null, null, e.message, null);
            result.errors++;
            result.details.push(`[${account.email}] extract failed "${msg.subject}": ${e.message}`);
            continue;
          }

          const qualifies = extracted.is_rate_con && (extracted.confidence ?? 0) >= MIN_CONFIDENCE;
          const emailId = await recordEmail(msg, extracted.is_rate_con, extracted.confidence, null, extracted);
          if (!emailId) continue; // a concurrent run already inserted it

          if (qualifies) {
            const loadId = await insertLoad(extracted, emailId);
            await q(`update emails set parsed_load_id = $1 where id = $2`, [loadId, emailId]);
            await postTeamNote(extracted, loadId);
            result.loadsAdded++;
            result.details.push(
              `[${account.email}] added: ${extracted.broker || "Unknown"} ${extracted.origin || "?"}→${extracted.dest || "?"} $${extracted.rate ?? "?"}`
            );
          } else {
            result.skipped++;
          }
        } catch (e: any) {
          result.errors++;
          result.details.push(`[${account.email}] ${id}: ${e.message}`);
        }
      }
    }
  } finally {
    running = false;
    lastResult = result;
    lastRunAt = result.ranAt;
  }
  return result;
}

async function recordEmail(
  msg: FetchedMessage,
  isRateCon: boolean | null,
  confidence: number | null,
  error: string | null,
  extracted: ExtractedLoad | null
): Promise<string | null> {
  const rows = await q(
    `insert into emails
       (mailbox, gmail_id, from_addr, subject, received_at, is_rate_con, confidence, raw_excerpt, attachment_count, processed_at, error, extract_json)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), $10, $11)
     on conflict (gmail_id) do nothing
     returning id`,
    [
      msg.mailbox,
      msg.gmailId,
      msg.from,
      msg.subject,
      msg.receivedAt,
      isRateCon,
      confidence,
      (msg.bodyText || "").slice(0, 1000),
      (msg.pdfs || []).length,
      error,
      extracted ? JSON.stringify(extracted) : null,
    ]
  );
  return rows[0]?.id || null;
}

async function insertLoad(x: ExtractedLoad, emailId: string): Promise<string> {
  const rpm = x.rate && x.miles ? round2(x.rate / x.miles) : null;
  const rows = await q(
    `insert into loads (date, broker, rate, miles, rpm, origin, dest, ref, commodity, status, source, source_email_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Available','email',$10)
     returning id`,
    [x.pickup_date || null, x.broker || "Unknown broker", x.rate, x.miles, rpm, x.origin, x.dest, x.ref, x.commodity, emailId]
  );
  return rows[0].id;
}

async function postTeamNote(x: ExtractedLoad, loadId: string) {
  const rpm = x.rate && x.miles ? (x.rate / x.miles).toFixed(2) : null;
  const lane = [x.origin, x.dest].filter(Boolean).join(" → ") || "lane TBD";
  const bits = [
    `📩 Auto-added from email: ${x.broker || "Unknown broker"}`,
    lane,
    x.rate != null ? `$${Number(x.rate).toLocaleString()}` : null,
    rpm ? `${rpm}/mi` : null,
    x.ref ? `ref ${x.ref}` : null,
  ].filter(Boolean);
  try {
    await q(`insert into messages (who, body, tag) values ($1,$2,$3)`, ["Inbox", bits.join(" · "), loadId]);
  } catch {
    /* a missing chat note is non-fatal */
  }
}

/** Start the background poller (called from index.ts when ingest is enabled). */
export function startPolling() {
  if (timer) return;
  const everyMs = Math.max(20000, parseInt(process.env.GMAIL_POLL_MS || "60000", 10));
  console.log(`Gmail ingest: polling every ${Math.round(everyMs / 1000)}s across ${getAccounts().length} mailbox(es).`);
  const tick = () =>
    runIngestOnce()
      .then((r) => {
        if (r.loadsAdded || r.errors) {
          console.log(`Gmail ingest: +${r.loadsAdded} load(s), ${r.errors} error(s) (scanned ${r.scanned}).`);
        }
      })
      .catch((e) => console.error("Gmail ingest tick failed:", e.message));
  setTimeout(tick, 8000); // first sweep shortly after boot
  timer = setInterval(tick, everyMs);
}

// `npm run ingest` — run one sweep from the command line, then exit.
const isMain = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  try { (process as any).loadEnvFile?.(); } catch { /* no .env — use inline/platform env */ }
  runIngestOnce()
    .then(async (r) => {
      console.log(JSON.stringify(r, null, 2));
      await pool.end();
      process.exit(r.ok ? 0 : 1);
    })
    .catch(async (e) => {
      console.error("Ingest failed:", e);
      await pool.end();
      process.exit(1);
    });
}
