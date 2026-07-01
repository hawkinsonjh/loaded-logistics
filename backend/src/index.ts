import express from "express";
import cors from "cors";
import { q } from "./db.js";
import {
  requireAuth, createOrgWithOwner, loginUser,
  checkLegacyPassword, legacyToken,
} from "./auth.js";
import { runAnalyst, runExecutor } from "./agents.js";
import { generateSocialPost, runRecruitingAgent } from "./recruiting.js";
import {
  searchInbox, getThread, createDraft, fetchStyleExamples,
  buildBrokerQuery, buildTrustedSenderQuery, BROKER_DOMAINS, detectBroker,
} from "./gmail.js";
import {
  processRateCon, approvePending, rejectPending, getRateConQueue,
} from "./ratecon.js";
import { PLANS, type PlanId } from "./plans.js";
import {
  billingConfigured, createCheckoutSession, createPortalSession, handleWebhook,
  getOrgState, withinTruckLimit, truckCount, accessState,
} from "./billing.js";

const app = express();
app.use(cors());                 // board is a separate origin; allow it

// Stripe webhook needs the raw body for signature verification — mount BEFORE json().
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  try {
    await handleWebhook(req.body as Buffer, sig || "");
    res.json({ received: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 8080;

/* ----------------------------- health ----------------------------- */
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ----------------------------- auth ----------------------------- */
// Legacy shared-password login — keeps Joe's existing team on the default org.
app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (typeof password === "string" && checkLegacyPassword(password)) {
    return res.json({ token: legacyToken() });
  }
  return res.status(401).json({ error: "Wrong password" });
});

// New carrier signs up → creates org + owner user, starts 14-day trial.
app.post("/api/auth/signup", async (req, res) => {
  const { orgName, email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  try {
    const session = await createOrgWithOwner({ orgName, email, password, name });
    res.json(session);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Email/password login for real accounts.
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  try {
    const session = await loginUser(email, password);
    if (!session) return res.status(401).json({ error: "Invalid email or password" });
    res.json(session);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Current session context: org, plan, usage, access state.
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const state = await getOrgState(req.orgId!);
    if (!state) return res.status(404).json({ error: "Org not found" });
    const trucksUsed = await truckCount(req.orgId!);
    res.json({
      orgId: state.id,
      orgName: state.name,
      plan: state.plan,
      planStatus: state.planStatus,
      trialEndsAt: state.trialEndsAt,
      truckLimit: state.truckLimit,
      trucksUsed,
      access: accessState(state),
      role: req.auth?.role || "owner",
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Per-org settings (driver roster, onboarding flag, etc.) stored in orgs.settings jsonb.
app.get("/api/org/settings", requireAuth, async (req, res) => {
  const rows = await q("select settings from orgs where id=$1", [req.orgId]);
  res.json(rows[0]?.settings || {});
});

app.patch("/api/org/settings", requireAuth, async (req, res) => {
  const patch = req.body || {};
  // Merge shallow into existing settings jsonb.
  const rows = await q(
    `update orgs set settings = coalesce(settings,'{}'::jsonb) || $1::jsonb, updated_at=now()
     where id=$2 returning settings`,
    [JSON.stringify(patch), req.orgId],
  );
  res.json(rows[0]?.settings || {});
});

// Rename the org (used in onboarding / account settings).
app.patch("/api/org", requireAuth, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Name required" });
  const rows = await q(
    "update orgs set name=$1, updated_at=now() where id=$2 returning id, name",
    [String(name).trim(), req.orgId],
  );
  res.json(rows[0]);
});

/* ----------------------------- plans + billing ----------------------------- */
app.get("/api/plans", (_req, res) => {
  res.json({ configured: billingConfigured(), plans: Object.values(PLANS) });
});

app.post("/api/billing/checkout", requireAuth, async (req, res) => {
  const { planId } = req.body || {};
  if (!planId || !(planId in PLANS)) return res.status(400).json({ error: "Valid planId required" });
  try {
    const url = await createCheckoutSession(req.orgId!, planId as PlanId);
    res.json({ url });
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

app.post("/api/billing/portal", requireAuth, async (req, res) => {
  try {
    const url = await createPortalSession(req.orgId!);
    res.json({ url });
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

/* ------------------------------- loads ----------------------------------- */
const LOAD_COLS = [
  "date","broker","rate","miles","rpm","origin","dest","driver","unit",
  "pay","fuel","dispatch","repair","dh","ref","commodity","status","source","source_email_id",
];

app.get("/api/loads", requireAuth, async (req, res) => {
  const rows = await q(
    `select id, to_char(date,'YYYY-MM-DD') as date, broker, rate, miles, rpm,
            origin, dest, driver, unit, pay, fuel, dispatch, repair, dh, ref, commodity, status, source
     from loads where org_id=$1 order by created_at desc`,
    [req.orgId]
  );
  res.json(rows);
});

// CSV / QuickBooks-friendly export — fixes the "no working accounting integration"
// complaint about legacy TMS. One click, real columns, importable anywhere.
app.get("/api/loads/export.csv", requireAuth, async (req, res) => {
  const rows = await q(
    `select to_char(date,'YYYY-MM-DD') as date, broker, origin, dest, driver, unit,
            rate, miles, rpm, pay, fuel, dispatch, repair, ref, commodity, status
     from loads where org_id=$1 order by date desc nulls last, created_at desc`,
    [req.orgId]
  );
  const cols = ["date","broker","origin","dest","driver","unit","rate","miles","rpm","pay","fuel","dispatch","repair","net","ref","commodity","status"];
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) {
    const net = (r.rate || 0) - (r.pay || 0) - (r.fuel || 0) - (r.dispatch || 0) - (r.repair || 0);
    lines.push(cols.map(c => esc(c === "net" ? net : r[c])).join(","));
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="loads-export.csv"');
  res.send(lines.join("\n"));
});

app.post("/api/loads", requireAuth, async (req, res) => {
  const b = req.body || {};
  // Enforce the plan's truck limit when a new unit would be introduced.
  if (b.unit && !(await withinTruckLimit(req.orgId!, b.unit))) {
    return res.status(402).json({ error: "Truck limit reached for your plan. Upgrade to add more trucks." });
  }
  const cols: string[] = ["org_id"];
  const vals: any[] = [req.orgId];
  const ph: string[] = ["$1"];
  for (const c of LOAD_COLS) {
    if (b[c] !== undefined) {
      cols.push(c);
      vals.push(b[c] === "" ? null : b[c]);
      ph.push("$" + vals.length);
    }
  }
  if (cols.length === 1) return res.status(400).json({ error: "No fields" });
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
  vals.push(req.orgId);
  const rows = await q(
    `update loads set ${sets.join(",")} where id = $${vals.length - 1} and org_id = $${vals.length}
     returning id, to_char(date,'YYYY-MM-DD') as date, broker, rate, miles, rpm,
               origin, dest, driver, unit, pay, fuel, dispatch, repair, dh, ref, commodity, status, source`,
    vals
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

app.delete("/api/loads/:id", requireAuth, async (req, res) => {
  await q(`delete from loads where id = $1 and org_id = $2`, [req.params.id, req.orgId]);
  res.json({ ok: true });
});

/* ----------------------------- team messages ----------------------------- */
app.get("/api/messages", requireAuth, async (req, res) => {
  const rows = await q(
    `select id, who, body, tag, extract(epoch from ts)*1000 as ts
     from messages where org_id=$1 order by ts asc limit 300`,
    [req.orgId]
  );
  res.json(rows);
});

app.post("/api/messages", requireAuth, async (req, res) => {
  const { who, body, tag } = req.body || {};
  if (!body) return res.status(400).json({ error: "Empty message" });
  const rows = await q(
    `insert into messages (org_id, who, body, tag) values ($1,$2,$3,$4)
     returning id, who, body, tag, extract(epoch from ts)*1000 as ts`,
    [req.orgId, who || "Dispatch", body, tag || null]
  );
  res.json(rows[0]);
});

/* ------------------------------- AI proxy -------------------------------- */
// Keeps your Anthropic key on the server. Used by Rate Cons extraction + Copilot.
async function callAnthropic(messages: any[], system: string, maxTokens = 1200) {
  // Strip whitespace and accidental wrapping quotes — common when pasting into a host's env UI.
  const key = (process.env.ANTHROPIC_API_KEY || "").trim().replace(/^['"]|['"]$/g, "");
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
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Anthropic error ${r.status}${body ? ": " + body.slice(0, 200) : ""}`);
  }
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

app.get("/api/candidates", requireAuth, async (req, res) => {
  const rows = await q("select * from candidates where org_id=$1 order by created_at desc", [req.orgId]);
  res.json(rows);
});

app.post("/api/candidates", requireAuth, async (req, res) => {
  const b = req.body || {};
  const cols: string[] = ["org_id"], vals: any[] = [req.orgId], ph: string[] = ["$1"];
  for (const c of CANDIDATE_COLS) {
    if (b[c] !== undefined) { cols.push(c); vals.push(b[c] === "" ? null : b[c]); ph.push("$" + vals.length); }
  }
  if (cols.length === 1) return res.status(400).json({ error: "No fields" });
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
  vals.push(req.orgId);
  const rows = await q(
    `update candidates set ${sets.join(",")} where id=$${vals.length - 1} and org_id=$${vals.length} returning *`,
    vals
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

app.delete("/api/candidates/:id", requireAuth, async (req, res) => {
  await q("delete from candidates where id=$1 and org_id=$2", [req.params.id, req.orgId]);
  res.json({ ok: true });
});

/* ------------------------------- agents ---------------------------------- */
// Analyst: read-only critique of the full fleet state.
app.post("/api/ai/analyze", requireAuth, async (req, res) => {
  try {
    const result = await runAnalyst(req.orgId!);
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
    const result = await runExecutor(goal, req.orgId!);
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
    const result = await generateSocialPost(platform, topic, req.orgId!);
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
    const result = await runRecruitingAgent(goal, req.orgId!);
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
      const rows = await q("select * from loads where id=$1 and org_id=$2", [loadId, req.orgId]);
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

/* -------------------- rate con agent pipeline -------------------- */

// GET /api/gmail/ratecons — review queue
app.get("/api/gmail/ratecons", requireAuth, async (req, res) => {
  try { res.json(await getRateConQueue(req.orgId!)); }
  catch (e: any) { res.status(503).json({ error: e.message }); }
});

// POST /api/gmail/ratecons/scan — search inbox for new rate cons and run the two-agent pipeline
app.post("/api/gmail/ratecons/scan", requireAuth, async (req, res) => {
  try {
    // Two searches: (1) broker domains with rate-con subject keywords, (2) trusted senders with no subject filter
    const brokerQ = buildBrokerQuery(
      '(subject:"rate confirmation" OR subject:"rate con" OR subject:"load confirmation" OR subject:"booking") newer_than:30d'
    );
    const trustedQ = buildTrustedSenderQuery();

    const [brokerThreads, trustedThreads] = await Promise.all([
      searchInbox(brokerQ, 30),
      searchInbox(trustedQ, 30),
    ]);

    // Merge, dedup by thread id (trusted sender threads may overlap with broker search)
    const seen = new Set<string>();
    const allThreads = [...trustedThreads, ...brokerThreads].filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    const results = [];
    for (const t of allThreads) {
      try {
        const r = await processRateCon(t.id, req.orgId!);
        results.push(r);
      } catch { /* skip individual failures */ }
    }
    res.json({ scanned: allThreads.length, results });
  } catch (e: any) { res.status(503).json({ error: e.message }); }
});

// POST /api/gmail/ratecons/process — process a specific thread
app.post("/api/gmail/ratecons/process", requireAuth, async (req, res) => {
  const { threadId } = req.body || {};
  if (!threadId) return res.status(400).json({ error: "threadId required" });
  try { res.json(await processRateCon(threadId, req.orgId!)); }
  catch (e: any) { res.status(503).json({ error: e.message }); }
});

// POST /api/gmail/ratecons/:id/approve — human approves a pending extraction
app.post("/api/gmail/ratecons/:id/approve", requireAuth, async (req, res) => {
  try { res.json(await approvePending(req.params.id, req.orgId!)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// POST /api/gmail/ratecons/:id/reject — human rejects a pending extraction
app.post("/api/gmail/ratecons/:id/reject", requireAuth, async (req, res) => {
  try { await rejectPending(req.params.id, req.orgId!); res.json({ ok: true }); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// GET /api/gmail/brokers — cross-reference: board brokers enriched with known email domains
app.get("/api/gmail/brokers", requireAuth, async (req, res) => {
  try {
    const rows = await q("select distinct broker from loads where org_id=$1 and broker is not null order by broker", [req.orgId]);
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
