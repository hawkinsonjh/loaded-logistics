// Two-agent rate confirmation pipeline.
//
// Agent 1 – Extractor: reads a Gmail thread and pulls structured load fields.
// Agent 2 – Reviewer:  QA-checks the extraction, flags issues, decides auto-approve.
//
// Auto-approve threshold: reviewer confidence >= 80 and no critical flags.
// Below that, the load lands in the human review queue before hitting the board.

import { q } from "./db.js";
import { getThread, isTrustedRateConSender } from "./gmail.js";

const MODEL = "claude-sonnet-4-6";

function getKey(): string {
  const k = (process.env.ANTHROPIC_API_KEY || "").trim().replace(/^['"]|['"]$/g, "");
  if (!k) throw new Error("ANTHROPIC_API_KEY not set");
  return k;
}

async function claude(system: string, user: string, maxTokens = 700): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Anthropic error ${r.status}${body ? ": " + body.slice(0, 200) : ""}`);
  }
  const d: any = await r.json();
  return (d.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
}

function parseJSON(raw: string): any {
  let t = raw.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b >= 0) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

/* ===================== AGENT 1: EXTRACTOR ===================== */

async function extractLoad(emailText: string): Promise<any> {
  const sys =
    "You extract a freight load from a broker rate confirmation email thread. " +
    "Respond ONLY with one JSON object — no prose, no code fences. Keys: " +
    "broker (string), rate (number — total linehaul USD), miles (number or null), " +
    "origin (\"City, ST\" or null), dest (\"City, ST\" or null), " +
    "date (pickup date YYYY-MM-DD or null), ref (load/PO number string or null), " +
    "commodity (string or null). " +
    "Never invent numbers. Use null for any field you cannot find.";
  const raw = await claude(sys, emailText.slice(0, 4000), 600);
  return parseJSON(raw);
}

/* ===================== AGENT 2: REVIEWER ===================== */

export interface ReviewResult {
  confidence: number;       // 0–100
  approved: boolean;        // true if confidence >= 80 and no critical flags
  flags: string[];          // concerns; empty when clean
  corrections: Record<string, any>;  // fields the reviewer is confident should be changed
}

async function reviewExtraction(
  extracted: any,
  emailSnippet: string,
  boardBrokers: string[],
): Promise<ReviewResult> {
  const knownBrokers = ["TQL", "RXO", "MegaCorp", "Armstrong", "Echo", "Coyote", "CH Robinson", ...boardBrokers];
  const rpm = extracted.rate && extracted.miles ? (extracted.rate / extracted.miles).toFixed(2) : "unknown";

  const sys =
    "You are the QA reviewer for Loaded Logistics, a small flatbed/dry-van carrier. " +
    "Review an AI-extracted load from a rate confirmation email and flag problems.\n\n" +
    "Known brokers: " + knownBrokers.join(", ") + "\n" +
    "RPM benchmarks: <$1.00 suspicious · $1.00–$1.79 thin · $1.80–$2.49 ok · $2.50+ strong · >$6.00 suspicious\n" +
    "Typical rate: $500–$8,000 · typical miles: 50–3,000\n" +
    "Today: " + new Date().toISOString().slice(0, 10) + "\n\n" +
    "Critical errors (set approved=false): missing rate, rate < $100, missing origin OR dest, miles > 5000.\n" +
    "Warnings (flag but may still approve): unrecognized broker, no ref number, RPM outside $1.00–$6.00, pickup date in past.\n\n" +
    "Respond ONLY with JSON (no prose, no code fences):\n" +
    '{"confidence":<0-100>,"approved":<true/false>,"flags":["..."],"corrections":{"field":"value"}}';

  const user =
    "Extracted load:\n" + JSON.stringify(extracted, null, 2) +
    "\nCalculated RPM: $" + rpm +
    "\n\nEmail snippet (first 1200 chars):\n" + emailSnippet.slice(0, 1200);

  const raw = await claude(sys, user, 500);
  return parseJSON(raw);
}

/* ===================== ORCHESTRATOR ===================== */

export interface RateConRecord {
  emailId: string;
  gmailId: string;
  subject: string;
  fromAddr: string;
  receivedFmt: string;
  extracted: any;
  confidence: number;
  flags: string[];
  reviewStatus: "pending" | "approved" | "rejected";
  loadId: string | null;
}

export async function processRateCon(threadId: string): Promise<RateConRecord> {
  // Idempotent — return existing record if already processed
  const existing = await q("select * from emails where gmail_id=$1", [threadId]);
  if (existing.length) return formatRecord(existing[0]);

  // Fetch thread from Gmail
  const thread = await getThread(threadId);
  const brokerMsg = thread.messages.find(m => !m.isFromMe) || thread.messages[0];
  // Build a combined transcript for the extractor to read
  const transcript = thread.messages
    .map(m => (m.isFromMe ? "[Joe]:" : "[Broker]:") + " " + m.body)
    .join("\n\n---\n\n");

  // Detect trusted sender — emails from Tucker Schaefer or Julia Ortiz at Armstrong
  const senderAddr = brokerMsg?.from || thread.fromAddr || "";
  const trustedSender = isTrustedRateConSender(senderAddr);

  // Load known brokers from DB for reviewer context
  const bRows = await q("select distinct broker from loads where broker is not null").catch(() => []);
  const boardBrokers = bRows.map((r: any) => r.broker).filter(Boolean);

  // Agent 1 — extract
  const extracted = await extractLoad(transcript);

  // Agent 2 — review and correct (skip for trusted senders to save API calls)
  let review: ReviewResult;
  if (trustedSender) {
    // Trusted contacts: auto-approve, still run extraction QA for corrections but force approve
    review = await reviewExtraction(extracted, transcript, boardBrokers);
    review.approved = true;
    review.confidence = Math.max(review.confidence, 90);
    if (!review.flags.includes("auto-approved: trusted sender")) {
      review.flags = [`trusted sender: ${senderAddr}`, ...review.flags];
    }
  } else {
    review = await reviewExtraction(extracted, transcript, boardBrokers);
  }

  // Apply reviewer corrections
  const finalLoad = { ...extracted, ...review.corrections };

  const row = await q(
    `insert into emails
       (mailbox, gmail_id, from_addr, subject, received_at, is_rate_con, raw_excerpt,
        extracted_json, reviewer_confidence, reviewer_flags, review_status)
     values ('inbox',$1,$2,$3,now(),true,$4,$5,$6,$7,$8)
     returning *`,
    [
      threadId,
      senderAddr,
      thread.subject,
      transcript.slice(0, 2000),
      JSON.stringify(finalLoad),
      review.confidence,
      JSON.stringify(review.flags),
      review.approved ? "approved" : "pending",
    ],
  );
  const emailRow = row[0];

  // Auto-create load if reviewer approved (includes all trusted senders)
  if (review.approved) {
    await createLoad(finalLoad, emailRow.id, threadId);
    const updated = await q("select * from emails where id=$1", [emailRow.id]);
    return formatRecord(updated[0]);
  }

  return formatRecord(emailRow);
}

async function createLoad(load: any, emailId: string, gmailId: string): Promise<any> {
  const ALLOWED = ["broker","rate","miles","origin","dest","date","ref","commodity"];
  const cols = ["source","source_email_id","status"];
  const vals: any[] = ["email", gmailId, "Available"];
  const ph = ["$1","$2","$3"];

  for (const c of ALLOWED) {
    if (load[c] != null && load[c] !== "") {
      cols.push(c); vals.push(load[c]); ph.push("$" + vals.length);
    }
  }
  if (load.rate && load.miles) {
    cols.push("rpm"); vals.push(+(load.rate / load.miles).toFixed(4)); ph.push("$" + vals.length);
  }

  const rows = await q(
    `insert into loads (${cols.join(",")}) values (${ph.join(",")}) returning *`,
    vals,
  );
  await q("update emails set parsed_load_id=$1, review_status='approved' where id=$2", [rows[0].id, emailId]);
  return rows[0];
}

// Human approves a pending extraction → creates the load
export async function approvePending(emailId: string): Promise<any> {
  const rows = await q("select * from emails where id=$1", [emailId]);
  if (!rows.length) throw new Error("Not found");
  const e = rows[0];
  if (e.review_status === "approved" && e.parsed_load_id) throw new Error("Already approved");
  const load = await createLoad(e.extracted_json, emailId, e.gmail_id);
  return load;
}

// Human rejects a pending extraction
export async function rejectPending(emailId: string): Promise<void> {
  await q("update emails set review_status='rejected' where id=$1", [emailId]);
}

// All processed rate cons for the review queue UI
export async function getRateConQueue(): Promise<RateConRecord[]> {
  const rows = await q(
    `select e.*, to_char(e.received_at,'Mon DD HH24:MI') as received_fmt
     from emails e where e.is_rate_con=true
     order by e.received_at desc limit 50`,
  );
  return rows.map(formatRecord);
}

function formatRecord(e: any): RateConRecord {
  return {
    emailId: e.id,
    gmailId: e.gmail_id,
    subject: e.subject || "(no subject)",
    fromAddr: e.from_addr || "",
    receivedFmt: e.received_fmt || "",
    extracted: e.extracted_json || {},
    confidence: +(e.reviewer_confidence || 0),
    flags: e.reviewer_flags || [],
    reviewStatus: e.review_status || "pending",
    loadId: e.parsed_load_id || null,
  };
}
