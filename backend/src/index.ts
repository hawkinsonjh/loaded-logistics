import express from "express";
import cors from "cors";
import { q } from "./db.js";
import { checkPassword, issueToken, requireAuth } from "./auth.js";

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

app.listen(PORT, () => console.log(`Loaded Logistics API listening on :${PORT}`));
