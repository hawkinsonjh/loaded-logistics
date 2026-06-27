import express from "express";
import cors from "cors";
import { q } from "./db.js";
import { checkPassword, issueToken, requireAuth, brokerCode, checkBrokerCode, issueBrokerToken, requireBroker } from "./auth.js";
import { extractLoad } from "./extract.js";
import { runIngestOnce, getIngestStatus, startPolling } from "./ingest.js";

const app = express();
app.set("trust proxy", true);    // behind Railway's proxy: gives us https in req.protocol
app.use(cors());                 // board is a separate origin; allow it
app.use(express.json({ limit: "8mb" }));   // headroom for base64 document uploads (client compresses first)

const PORT = process.env.PORT || 8080;

/* ----------------------------- health + auth ----------------------------- */
// Public health check. Exposes only booleans (never the key itself) so you can
// confirm at a glance whether the backend actually sees its config.
app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    ai: !!process.env.ANTHROPIC_API_KEY,            // true once ANTHROPIC_API_KEY is set on THIS service
    ingest: process.env.GMAIL_INGEST_ENABLED === "true",
  })
);

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (typeof password === "string" && checkPassword(password)) {
    return res.json({ token: issueToken() });
  }
  return res.status(401).json({ error: "Wrong password" });
});

/* ------------------------------- loads ----------------------------------- */
// Columns a client may write via POST/PATCH (whitelist).
const LOAD_COLS = [
  "date","broker","rate","miles","rpm","origin","dest","driver","unit",
  "pay","fuel","dispatch","repair","dh","ref","commodity","status","source","source_email_id",
  // Phase 3 — billing & A/R
  "billing_status","invoiced_at","paid_at",
  // Phase 3 — detention & accessorials
  "detention_hours","detention_pay","lumper","accessorial",
  // Phase 3 — paperwork
  "ratecon_received","bol_received","pod_received","doc_link",
  // Phase 3 — settlements
  "advance",
];

// One source of truth for what a load row looks like coming back (dates → ISO).
const LOAD_SELECT = `id, to_char(date,'YYYY-MM-DD') as date, broker, rate, miles, rpm,
  origin, dest, driver, unit, pay, fuel, dispatch, repair, dh, ref, commodity, status, source,
  billing_status, to_char(invoiced_at,'YYYY-MM-DD') as invoiced_at, to_char(paid_at,'YYYY-MM-DD') as paid_at,
  detention_hours, detention_pay, lumper, accessorial,
  ratecon_received, bol_received, pod_received, doc_link, advance`;

app.get("/api/loads", requireAuth, async (_req, res) => {
  const rows = await q(`select ${LOAD_SELECT} from loads order by created_at desc`);
  res.json(rows);
});

app.post("/api/loads", requireAuth, async (req, res) => {
  const b = req.body || {};
  const cols: string[] = [];
  const vals: any[] = [];
  const ph: string[] = [];
  for (const c of LOAD_COLS) {
    if (b[c] !== undefined) {
      cols.push(c);
      vals.push(b[c] === "" ? null : b[c]);
      ph.push("$" + vals.length);
    }
  }
  if (!cols.length) return res.status(400).json({ error: "No fields" });
  const rows = await q(
    `insert into loads (${cols.join(",")}) values (${ph.join(",")}) returning ${LOAD_SELECT}`,
    vals
  );
  res.json(rows[0]);
});

app.patch("/api/loads/:id", requireAuth, async (req, res) => {
  const b = req.body || {};
  const sets: string[] = [];
  const vals: any[] = [];
  for (const c of LOAD_COLS) {
    if (b[c] !== undefined) {
      vals.push(b[c] === "" ? null : b[c]);
      sets.push(`${c} = $${vals.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: "No fields" });
  sets.push(`updated_at = now()`);
  vals.push(req.params.id);
  const rows = await q(
    `update loads set ${sets.join(",")} where id = $${vals.length} returning ${LOAD_SELECT}`,
    vals
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

app.delete("/api/loads/:id", requireAuth, async (req, res) => {
  await q(`delete from loads where id = $1`, [req.params.id]);
  res.json({ ok: true });
});

/* --------------------- public shipment tracking (no auth) ----------------- */
// Customer/broker-facing: look up a single load by its reference number and
// return ONLY non-financial status fields. No rate, pay, fuel, driver pay, or
// margin ever leaves this route — it is intentionally public (the Customer
// Portal calls it without a token). Refs are short, so this is "tracking-grade"
// privacy, not a secret; production should issue a longer opaque tracking token.
app.get("/api/track/:ref", async (req, res) => {
  const ref = String(req.params.ref || "").trim();
  if (!ref) return res.status(400).json({ error: "No reference" });
  const rows = await q(
    `select ref, broker, origin, dest, status, commodity,
            to_char(date,'YYYY-MM-DD') as pickup_date,
            extract(epoch from updated_at)*1000 as updated
     from loads where lower(ref) = lower($1) order by created_at desc limit 1`,
    [ref]
  );
  if (!rows.length) return res.status(404).json({ error: "No shipment found for that reference." });
  const l = rows[0];
  res.json({
    ref: l.ref,
    broker: l.broker,
    origin: l.origin,
    dest: l.dest,
    commodity: l.commodity,
    status: l.status,
    pickup_date: l.pickup_date,
    updated: l.updated,
    carrier: "Loaded Logistics",
  });
});

/* ---------------------------- load documents ----------------------------- */
// Drivers upload a (client-compressed) photo of the BOL/POD. We store the bytes,
// flip the matching paperwork flag, and point the load's doc_link at the freshest
// upload so the board / broker portal / owner views surface it with no extra work.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOC_KINDS = ["pod", "bol", "ratecon", "other"];

app.post("/api/loads/:id/docs", requireAuth, async (req, res) => {
  const { kind, filename, mime, dataBase64, uploadedBy } = req.body || {};
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "Load not found" });
  if (!dataBase64) return res.status(400).json({ error: "No file data" });
  const buf = Buffer.from(String(dataBase64), "base64");
  if (!buf.length) return res.status(400).json({ error: "Empty file" });
  const k = DOC_KINDS.includes(kind) ? kind : "other";
  const ins = await q(
    `insert into documents (load_id, kind, filename, mime, bytes, size_bytes, uploaded_by)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning id, kind, filename, mime, size_bytes, extract(epoch from created_at)*1000 as created_at`,
    [req.params.id, k, filename || null, mime || "image/jpeg", buf, buf.length, uploadedBy || null]
  );
  const doc = ins[0];
  const url = `${req.protocol}://${req.get("host")}/api/docs/${doc.id}`;
  const flagCol = k === "pod" ? "pod_received" : k === "bol" ? "bol_received" : k === "ratecon" ? "ratecon_received" : null;
  const sets = ["doc_link = $1", "updated_at = now()"];
  const vals: any[] = [url];
  if (flagCol) sets.push(`${flagCol} = true`);
  vals.push(req.params.id);
  const upd = await q(`update loads set ${sets.join(",")} where id = $${vals.length} returning ${LOAD_SELECT}`, vals);
  res.json({ doc: { ...doc, url }, load: upd[0] || null });
});

app.get("/api/loads/:id/docs", requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.json([]);
  const rows = await q(
    `select id, kind, filename, mime, size_bytes, extract(epoch from created_at)*1000 as created_at, uploaded_by
     from documents where load_id = $1 order by created_at desc`,
    [req.params.id]
  );
  const host = `${req.protocol}://${req.get("host")}`;
  res.json(rows.map((r: any) => ({ ...r, url: `${host}/api/docs/${r.id}` })));
});

// Public: serve a stored document by id. The UUID is the capability (unguessable),
// same privacy model as /api/track — needed so plain <img src> / <a href> work
// without an auth header (brokers hold a different token; drivers open in-app).
app.get("/api/docs/:id", async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "Not found" });
  const rows = await q(`select mime, bytes, filename from documents where id = $1`, [req.params.id]);
  const d = rows[0];
  if (!d || !d.bytes) return res.status(404).json({ error: "Not found" });
  res.setHeader("Content-Type", d.mime || "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.setHeader("Content-Disposition", `inline; filename="${String(d.filename || "document").replace(/"/g, "")}"`);
  res.send(d.bytes);
});

/* --------------------------- broker portal ------------------------------- */
// A broker proves it knows the access code for its company name, gets a token
// scoped to that one broker, and can then read ONLY its own loads — sanitized:
// no pay/fuel/dispatch/repair/rpm/margin ever leaves these routes. The broker
// DOES see the agreed rate + accessorials + billing status (their invoice view).
const brokerNorm = (s: any) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

app.post("/api/broker/login", async (req, res) => {
  const { broker, code } = req.body || {};
  if (!broker || !code) return res.status(400).json({ error: "Company name and access code required." });
  if (!checkBrokerCode(broker, code)) return res.status(401).json({ error: "Wrong company name or access code." });
  // Confirm the company actually has loads (and recover the canonical display name).
  const rows = await q(
    `select broker from loads where lower(trim(broker)) = $1 order by created_at desc limit 1`,
    [brokerNorm(broker)]
  );
  if (!rows.length) return res.status(404).json({ error: "No shipments on file for that company." });
  res.json({ token: issueBrokerToken(broker), broker: rows[0].broker });
});

app.get("/api/broker/loads", requireBroker, async (req, res) => {
  const norm = (req as any).broker;
  const rows = await q(
    `select id, to_char(date,'YYYY-MM-DD') as date, broker, rate, miles, origin, dest, ref, commodity,
            status, driver, unit,
            billing_status, to_char(invoiced_at,'YYYY-MM-DD') as invoiced_at, to_char(paid_at,'YYYY-MM-DD') as paid_at,
            detention_pay, lumper, accessorial,
            ratecon_received, bol_received, pod_received, doc_link,
            extract(epoch from updated_at)*1000 as updated
     from loads where lower(trim(broker)) = $1 order by created_at desc`,
    [norm]
  );
  res.json(rows);
});

// Team-only: every broker's access code, so dispatch can hand them out.
app.get("/api/broker/codes", requireAuth, async (_req, res) => {
  const rows = await q(
    `select broker, count(*)::int as loads from loads
     where broker is not null and trim(broker) <> '' group by broker order by count(*) desc`
  );
  res.json(rows.map((r: any) => ({ broker: r.broker, loads: r.loads, code: brokerCode(r.broker) })));
});

/* ----------------------------- team messages ----------------------------- */
app.get("/api/messages", requireAuth, async (_req, res) => {
  const rows = await q(
    `select id, who, body, tag, extract(epoch from ts)*1000 as ts
     from messages order by ts asc limit 300`
  );
  res.json(rows);
});

app.post("/api/messages", requireAuth, async (req, res) => {
  const { who, body, tag } = req.body || {};
  if (!body) return res.status(400).json({ error: "Empty message" });
  const rows = await q(
    `insert into messages (who, body, tag) values ($1,$2,$3)
     returning id, who, body, tag, extract(epoch from ts)*1000 as ts`,
    [who || "Dispatch", body, tag || null]
  );
  res.json(rows[0]);
});

/* ------------------------------- AI proxy -------------------------------- */
// Keeps your Anthropic key on the server. Used by Rate Cons extraction + Copilot.
async function callAnthropic(messages: any[], system: string, maxTokens = 1200) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error("Anthropic error " + r.status + (detail ? " " + detail.slice(0, 300) : ""));
  }
  const data: any = await r.json();
  return (data.content || []).map((c: any) => (c.type === "text" ? c.text : "")).join("\n");
}

app.post("/api/ai/extract", requireAuth, async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: "No text" });
  try {
    // Shared extractor — the SAME parser the Phase 2 Gmail worker uses.
    const load = await extractLoad({ text });
    // The board posts text and parses { text: "<json>" } back (board/src/api.ts).
    res.json({ text: JSON.stringify(load) });
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

/* --------------------------- Phase 2: email ingest ------------------------ */
// Manually trigger one sweep of the inboxes (also runs automatically on a timer).
app.post("/api/ingest/run", requireAuth, async (_req, res) => {
  try {
    const result = await runIngestOnce();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Health/inspection for the email worker: enabled? configured? last run?
app.get("/api/ingest/status", requireAuth, (_req, res) => {
  res.json(getIngestStatus());
});

// What the worker has actually read — powers the Inbox view on the board.
app.get("/api/emails", requireAuth, async (_req, res) => {
  const rows = await q(
    `select id, mailbox, from_addr, subject,
            extract(epoch from received_at)*1000 as received_at,
            is_rate_con, confidence, parsed_load_id, attachment_count, error,
            extract(epoch from processed_at)*1000 as processed_at, extract_json
     from emails order by coalesce(received_at, processed_at) desc nulls last limit 100`
  );
  res.json(rows);
});

// Promote a recorded-but-not-added email (skipped / low confidence) into a load.
app.post("/api/emails/:id/promote", requireAuth, async (req, res) => {
  const rows = await q(`select id, from_addr, subject, parsed_load_id, extract_json from emails where id = $1`, [req.params.id]);
  const em = rows[0];
  if (!em) return res.status(404).json({ error: "Email not found" });
  if (em.parsed_load_id) return res.status(409).json({ error: "Already added", loadId: em.parsed_load_id });

  const x = em.extract_json || {};
  const rate = num(x.rate), miles = num(x.miles);
  const rpm = rate && miles ? Math.round((rate / miles) * 100) / 100 : null;
  const inserted = await q(
    `insert into loads (date, broker, rate, miles, rpm, origin, dest, ref, commodity,
                        status, source, source_email_id, ratecon_received)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Available','email',$10,true) returning ${LOAD_SELECT}`,
    [x.pickup_date || null, x.broker || ("From " + (em.from_addr || "email")), rate, miles, rpm,
     x.origin || null, x.dest || null, x.ref || null, x.commodity || null, em.id]
  );
  const load = inserted[0];
  await q(`update emails set parsed_load_id = $1 where id = $2`, [load.id, em.id]);
  const lane = [x.origin, x.dest].filter(Boolean).join(" → ") || (em.subject || "lane TBD");
  await q(`insert into messages (who, body, tag) values ($1,$2,$3)`,
    ["Inbox", `📥 Added from inbox (manual): ${load.broker} · ${lane}`, load.id]).catch(() => {});
  res.json(load);
});

/* --------------------------- Phase 3: IFTA / fuel ------------------------- */
function num(v: any): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

app.get("/api/fuel", requireAuth, async (_req, res) => {
  const rows = await q(
    `select id, to_char(date,'YYYY-MM-DD') as date, state, gallons, amount, unit, driver
     from fuel_purchases order by date desc nulls last, created_at desc`
  );
  res.json(rows);
});

app.post("/api/fuel", requireAuth, async (req, res) => {
  const b = req.body || {};
  const rows = await q(
    `insert into fuel_purchases (date, state, gallons, amount, unit, driver)
     values ($1,$2,$3,$4,$5,$6)
     returning id, to_char(date,'YYYY-MM-DD') as date, state, gallons, amount, unit, driver`,
    [b.date || null, (b.state || "").toUpperCase().slice(0, 2) || null, num(b.gallons), num(b.amount), b.unit || null, b.driver || null]
  );
  res.json(rows[0]);
});

app.delete("/api/fuel/:id", requireAuth, async (req, res) => {
  await q(`delete from fuel_purchases where id = $1`, [req.params.id]);
  res.json({ ok: true });
});

// Per-quarter taxable miles by jurisdiction (upsert one cell at a time).
app.get("/api/ifta/miles", requireAuth, async (req, res) => {
  const quarter = String(req.query.quarter || "");
  const rows = quarter
    ? await q(`select jurisdiction, miles from ifta_miles where quarter = $1`, [quarter])
    : await q(`select quarter, jurisdiction, miles from ifta_miles`);
  res.json(rows);
});

app.put("/api/ifta/miles", requireAuth, async (req, res) => {
  const { quarter, jurisdiction, miles } = req.body || {};
  if (!quarter || !jurisdiction) return res.status(400).json({ error: "quarter and jurisdiction required" });
  await q(
    `insert into ifta_miles (quarter, jurisdiction, miles) values ($1,$2,$3)
     on conflict (quarter, jurisdiction) do update set miles = excluded.miles, updated_at = now()`,
    [quarter, String(jurisdiction).toUpperCase().slice(0, 2), Math.max(0, Math.round(num(miles) || 0))]
  );
  res.json({ ok: true });
});

app.post("/api/ai/copilot", requireAuth, async (req, res) => {
  const { messages, context } = req.body || {};
  const sys =
    "You are a sharp truckload dispatch copilot for a small carrier. Be concise and decisive, use the data given. " +
    "RPM under $1.80 is thin, $1.80-2.49 is ok, $2.50+ is strong. When pairing loads to drivers, prefer the driver " +
    "whose recent brokers/lanes match. You can also answer back-office questions from the `billing` object: " +
    "openAR is unpaid invoiced dollars, uncollectedDetention is detention owed but not yet paid, and overdueInvoices " +
    "lists invoices out more than 30 days (chase the oldest/biggest first). Current board state JSON: " + JSON.stringify(context || {});
  try {
    const out = await callAnthropic(messages || [], sys, 900);
    res.json({ text: out });
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Loaded Logistics API listening on :${PORT}`);
  // Phase 2: start the Gmail rate-con poller only when explicitly enabled AND configured.
  const ingest = getIngestStatus();
  if (ingest.enabled && ingest.configured) {
    startPolling();
  } else if (ingest.enabled && !ingest.configured) {
    console.log("Gmail ingest is enabled but not configured (set GOOGLE_CLIENT_ID/SECRET + GMAIL_ACCOUNTS).");
  }
});
