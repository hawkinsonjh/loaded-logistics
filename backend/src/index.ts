import express from "express";
import cors from "cors";
import { q } from "./db.js";
import { checkPassword, issueToken, requireAuth } from "./auth.js";
import { runAnalyst, runExecutor } from "./agents.js";
import { generateSocialPost, runRecruitingAgent } from "./recruiting.js";
import {
  searchInbox, getThread, createDraft, fetchStyleExamples,
  buildBrokerQuery, BROKER_DOMAINS, detectBroker,
} from "./gmail.js";

const app = express();
app.use(cors());                 // board is a separate origin; allow it
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 8080;

/* ----------------------------- health + auth ----------------------------- */
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (typeof password === "string" && checkPassword(password)) {
    return res.json({ token: issueToken() });
  }
  return res.status(401).json({ error: "Wrong password" });
});

/* ------------------------------- loads ----------------------------------- */
const LOAD_COLS = [
  "date","broker","rate","miles","rpm","origin","dest","driver","unit",
  "pay","fuel","dispatch","repair","dh","ref","commodity","status","source","source_email_id",
];

app.get("/api/loads", requireAuth, async (_req, res) => {
  const rows = await q(
    `select id, to_char(date,'YYYY-MM-DD') as date, broker, rate, miles, rpm,
            origin, dest, driver, unit, pay, fuel, dispatch, repair, dh, ref, commodity, status, source
     from loads order by created_at desc`
  );
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
    `insert into loads (${cols.join(",")}) values (${ph.join(",")})
     returning id, to_char(date,'YYYY-MM-DD') as date, broker, rate, miles, rpm,
               origin, dest, driver, unit, pay, fuel, dispatch, repair, dh, ref, commodity, status, source`,
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
    `update loads set ${sets.join(",")} where id = $${vals.length}
     returning id, to_char(date,'YYYY-MM-DD') as date, broker, rate, miles, rpm,
               origin, dest, driver, unit, pay, fuel, dispatch, repair, dh, ref, commodity, status, source`,
    vals
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

app.delete("/api/loads/:id", requireAuth, async (req, res) => {
  await q(`delete from loads where id = $1`, [req.params.id]);
  res.json({ ok: true });
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
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages }),
  });
  if (!r.ok) throw new Error("Anthropic error " + r.status);
  const data: any = await r.json();
  return (data.content || []).map((c: any) => (c.type === "text" ? c.text : "")).join("\n");
}

app.post("/api/ai/extract", requireAuth, async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: "No text" });
  const sys =
    "You extract a freight load from a pasted broker email or rate confirmation. " +
    "Respond ONLY with one JSON object, no prose, no code fences. Keys: broker (string), " +
    "rate (number, total linehaul in USD), miles (number or null), origin (string 'City, ST' or null), " +
    "dest (string 'City, ST' or null), pickup_date (YYYY-MM-DD or null), ref (string load/PO number or null), " +
    "commodity (string or null), notes (string or null). If unknown use null. Never invent numbers.";
  try {
    const out = await callAnthropic([{ role: "user", content: text }], sys, 700);
    res.json({ text: out });
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

app.post("/api/ai/copilot", requireAuth, async (req, res) => {
  const { messages, context } = req.body || {};
  const sys =
    "You are a sharp truckload dispatch copilot for a small carrier. Be concise and decisive, use the data given. " +
    "RPM under $1.80 is thin, $1.80-2.49 is ok, $2.50+ is strong. When pairing loads to drivers, prefer the driver " +
    "whose recent brokers/lanes match. Current board state JSON: " + JSON.stringify(context || {});
  try {
    const out = await callAnthropic(messages || [], sys, 900);
    res.json({ text: out });
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

/* ----------------------------- candidates -------------------------------- */
const CANDIDATE_COLS = ["name","phone","email","cdl_class","experience","status","source","notes"];

app.get("/api/candidates", requireAuth, async (_req, res) => {
  const rows = await q("select * from candidates order by created_at desc");
  res.json(rows);
});

app.post("/api/candidates", requireAuth, async (req, res) => {
  const b = req.body || {};
  const cols: string[] = [], vals: any[] = [], ph: string[] = [];
  for (const c of CANDIDATE_COLS) {
    if (b[c] !== undefined) { cols.push(c); vals.push(b[c] === "" ? null : b[c]); ph.push("$" + vals.length); }
  }
  if (!cols.length) return res.status(400).json({ error: "No fields" });
  const rows = await q(
    `insert into candidates (${cols.join(",")}) values (${ph.join(",")}) returning *`,
    vals
  );
  res.json(rows[0]);
});

app.patch("/api/candidates/:id", requireAuth, async (req, res) => {
  const b = req.body || {};
  const sets: string[] = [], vals: any[] = [];
  for (const c of CANDIDATE_COLS) {
    if (b[c] !== undefined) { vals.push(b[c] === "" ? null : b[c]); sets.push(`${c}=$${vals.length}`); }
  }
  if (!sets.length) return res.status(400).json({ error: "No fields" });
  sets.push("updated_at=now()");
  vals.push(req.params.id);
  const rows = await q(
    `update candidates set ${sets.join(",")} where id=$${vals.length} returning *`,
    vals
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

app.delete("/api/candidates/:id", requireAuth, async (req, res) => {
  await q("delete from candidates where id=$1", [req.params.id]);
  res.json({ ok: true });
});

/* ------------------------------- agents ---------------------------------- */
// Analyst: read-only critique of the full fleet state.
app.post("/api/ai/analyze", requireAuth, async (_req, res) => {
  try {
    const result = await runAnalyst();
    res.json(result);
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

// Executor: agentic tool-use loop that can read AND write the board.
app.post("/api/ai/execute", requireAuth, async (req, res) => {
  const { goal } = req.body || {};
  if (!goal) return res.status(400).json({ error: "No goal provided" });
  try {
    const result = await runExecutor(goal);
    res.json(result);
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

// Social content generator: single-call, non-agentic.
app.post("/api/ai/social", requireAuth, async (req, res) => {
  const { platform, topic } = req.body || {};
  if (!platform || !topic) return res.status(400).json({ error: "Missing platform or topic" });
  try {
    const result = await generateSocialPost(platform, topic);
    res.json(result);
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

// Recruiting agent: agentic loop that manages candidate pipeline + drafts outreach.
app.post("/api/ai/recruit", requireAuth, async (req, res) => {
  const { goal } = req.body || {};
  if (!goal) return res.status(400).json({ error: "No goal provided" });
  try {
    const result = await runRecruitingAgent(goal);
    res.json(result);
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

/* ----------------------------- gmail --------------------------------- */

// GET /api/gmail/inbox?q=<extra_query>&limit=20
app.get("/api/gmail/inbox", requireAuth, async (req, res) => {
  const extra = (req.query.q as string) || "";
  const limit = Math.min(parseInt((req.query.limit as string) || "20"), 50);
  try {
    const query = buildBrokerQuery(extra ? extra : "newer_than:60d");
    const threads = await searchInbox(query, limit);
    res.json(threads);
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

// GET /api/gmail/thread/:id
app.get("/api/gmail/thread/:id", requireAuth, async (req, res) => {
  try {
    const thread = await getThread(req.params.id);
    res.json(thread);
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

// POST /api/gmail/draft  — { to, subject, body, threadId?, inReplyTo? }
app.post("/api/gmail/draft", requireAuth, async (req, res) => {
  const { to, subject, body, threadId, inReplyTo } = req.body || {};
  if (!to || !body) return res.status(400).json({ error: "to and body required" });
  try {
    const draftId = await createDraft(to, subject || "(no subject)", body, inReplyTo, inReplyTo, threadId);
    res.json({ draftId });
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

// POST /api/ai/compose  — AI-drafts an email in Joe's voice using past thread history
// Body: { broker, brokerEmail, context, loadId? }
app.post("/api/ai/compose", requireAuth, async (req, res) => {
  const { broker, brokerEmail, context, loadId } = req.body || {};
  if (!context) return res.status(400).json({ error: "context required" });

  // Fetch load details if referenced
  let loadDetail = "";
  if (loadId) {
    try {
      const rows = await q("select * from loads where id=$1", [loadId]);
      if (rows.length) {
        const l = rows[0];
        loadDetail = `Load ref #${l.ref || l.id}: ${l.origin || "?"} → ${l.dest || "?"}, ` +
          `$${l.rate}, ${l.miles} mi, driver: ${l.driver || "TBD"}`;
      }
    } catch { /* ignore */ }
  }

  // Fetch style examples from Gmail
  let styleBlock = "";
  if (brokerEmail) {
    try {
      const examples = await fetchStyleExamples(brokerEmail, 8);
      if (examples.length) {
        styleBlock = "\n\nHere are real email examples Joe has sent to this broker. " +
          "Match his voice exactly — short, direct, casual:\n\n" +
          examples.map((e, i) => `--- Example ${i + 1} ---\n${e}`).join("\n\n");
      }
    } catch { /* style fetch is best-effort */ }
  }

  const brokerLine = broker || brokerEmail || "the broker";
  const sys = `You are drafting a freight dispatch email for Joseph Hawkinson, owner of Loaded Logistics.

His writing style:
- Ultra-short, 1–4 sentences max
- Casual and friendly: "brother", "boss", "Yessir" feel natural
- Never verbose, never formal or corporate
- Load inquiry format: MC#, pickup city, dropoff city, trip miles, ref#
- Booking confirmation: "Let's go ahead and book it! Driver is [Name]"
- Status update: "We're in route", "On site waiting"
- Signs as:
Joseph Hawkinson
Owner & Founder
Loaded Logistics
(704)-962-4987
www.loadedlogisticsnc.com
${styleBlock}

Write ONLY the email body + signature. No subject line. No meta commentary.`;

  const prompt = `Draft an email to ${brokerLine}.${loadDetail ? " Load: " + loadDetail + "." : ""} Context: ${context}`;
  try {
    const out = await callAnthropic([{ role: "user", content: prompt }], sys, 400);
    res.json({ text: out });
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

// GET /api/gmail/brokers — cross-reference: board brokers enriched with known email domains
app.get("/api/gmail/brokers", requireAuth, async (_req, res) => {
  try {
    const rows = await q("select distinct broker from loads where broker is not null order by broker");
    const result = rows.map((r: any) => {
      const name = r.broker;
      const domains = BROKER_DOMAINS[name] || [];
      const match = Object.entries(BROKER_DOMAINS).find(([k]) =>
        name.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(name.toLowerCase())
      );
      return { name, domains: match ? match[1] : domains, detected: !!match };
    });
    res.json(result);
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Loaded Logistics API listening on :${PORT}`));
