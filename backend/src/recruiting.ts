import { q } from "./db.js";

const API_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";

function getKey(): string {
  // Strip whitespace and accidental wrapping quotes — common when pasting into a host's env UI.
  const k = (process.env.ANTHROPIC_API_KEY || "").trim().replace(/^['"]|['"]$/g, "");
  if (!k) throw new Error("ANTHROPIC_API_KEY not set");
  return k;
}

async function anthropic(body: object): Promise<any> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getKey(),
      "anthropic-version": API_VERSION,
    },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Anthropic error ${r.status}${body ? ": " + body.slice(0, 200) : ""}`);
  }
  return r.json();
}

function textFrom(content: any[]): string {
  return (content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
}

function parseJSON(raw: string): any {
  let t = raw.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b >= 0) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

/* ===================== SOCIAL CONTEXT ===================== */

// Per-org company name, defaulting to a generic label.
async function orgName(orgId: string): Promise<string> {
  const rows = await q("select name from orgs where id=$1", [orgId]).catch(() => []);
  return rows[0]?.name || "our carrier";
}

async function buildSocialContext(orgId: string) {
  const loads = await q("select rate, miles, rpm, driver, unit, broker, origin, dest, status from loads where org_id=$1 order by created_at desc limit 100", [orgId]);
  let rev = 0, miles = 0, rpmN = 0, rpmC = 0;
  const drivers = new Set<string>();
  const units = new Set<string>();
  const brokers = new Set<string>();
  const states = new Set<string>();

  loads.forEach((l: any) => {
    rev += l.rate || 0;
    miles += l.miles || 0;
    const rpm: number | null = l.rpm ?? (l.rate && l.miles ? l.rate / l.miles : null);
    if (rpm) { rpmN += rpm; rpmC++; }
    if (l.driver) drivers.add(l.driver);
    if (l.unit) units.add(l.unit);
    if (l.broker) brokers.add(l.broker);
    if (l.origin) { const s = l.origin.split(",")[1]?.trim(); if (s) states.add(s); }
    if (l.dest)   { const s = l.dest.split(",")[1]?.trim();   if (s) states.add(s); }
  });

  return {
    companyName: await orgName(orgId),
    truckCount: units.size,
    driverCount: drivers.size,
    avgRpm: rpmC ? +(rpmN / rpmC).toFixed(2) : null,
    totalRevenue: Math.round(rev),
    totalMiles: Math.round(miles),
    statesServed: Array.from(states).slice(0, 8),
    topBrokers: Array.from(brokers).slice(0, 5),
    recentLoadCount: loads.length,
  };
}

/* ===================== SOCIAL CONTENT GENERATOR ===================== */
// Non-agentic single-call generation. Returns post text + hashtags for the chosen platform/topic.

const PLATFORM_RULES: Record<string, string> = {
  Facebook:    "Conversational, 150–280 words, use paragraph breaks, 1–2 emojis max. Feel personal and authentic.",
  Instagram:   "Punchy opening hook, 80–140 words, exclude hashtags from the body (they go in the array). 2–3 emojis.",
  LinkedIn:    "Professional tone, 150–220 words, emphasise earning potential and company stability. Minimal emojis.",
  "Twitter/X": "Under 240 characters, punchy, one strong CTA. No hashtags in body.",
};

const TOPIC_PROMPTS: Record<string, string> = {
  "Driver Recruiting":      "Recruiting post targeting experienced CDL-A drivers. Lead with earning potential and home time. Make it feel like a real opportunity, not a generic job ad.",
  "Performance Highlight":  "Celebrate a strong operational week — reference specific RPM numbers, load volume, or lane performance to show the carrier is running profitably.",
  "Lane Spotlight":         "Highlight a specific lane or region the carrier runs often. Mention the destination state, typical pay, and why drivers enjoy it.",
  "Company Culture":        "What it's actually like to work here — how dispatch treats drivers, communication style, the team atmosphere. Authentic, not PR-speak.",
  "Milestone":              "Celebrate a company milestone: a delivery count, revenue goal, new truck, or anniversary. Keep it humble and genuine.",
};

export async function generateSocialPost(
  platform: string,
  topic: string,
  orgId: string
): Promise<{ post: string; hashtags: string[] }> {
  const ctx = await buildSocialContext(orgId);
  const rules = PLATFORM_RULES[platform] ?? PLATFORM_RULES["Facebook"];
  const topicGuide = TOPIC_PROMPTS[topic] ?? TOPIC_PROMPTS["Driver Recruiting"];

  const system =
    `You are a social media strategist writing for ${ctx.companyName}, a small but profitable trucking carrier. ` +
    `Use real numbers from the fleet context to make posts specific and credible. ` +
    `Tone: authentic trucking industry voice — knowledgeable, straight-talking, not corporate. ` +
    `${topicGuide} ` +
    `Platform rules for ${platform}: ${rules} ` +
    `Respond ONLY with JSON: { "post": string, "hashtags": string[] }. ` +
    `The post field must NOT contain hashtags. Hashtags array: 6–10 items including the # symbol.`;

  const user = `Fleet context:\n${JSON.stringify(ctx, null, 2)}`;
  const resp = await anthropic({ max_tokens: 800, system, messages: [{ role: "user", content: user }] });
  const raw = textFrom(resp.content);

  try {
    const j = parseJSON(raw);
    return { post: j.post || raw, hashtags: Array.isArray(j.hashtags) ? j.hashtags : [] };
  } catch {
    return { post: raw, hashtags: [] };
  }
}

/* ===================== RECRUITING AGENT ===================== */
// Agentic tool-use loop: manages candidate pipeline + drafts outreach.

const CAND_SAFE_COLS = ["name", "phone", "email", "cdl_class", "experience", "status", "source", "notes"];

const RECRUITING_TOOLS = [
  {
    name: "list_candidates",
    description: "Get driver candidates from the pipeline filtered by status, or all.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["New","Contacted","Interview","Offer","Hired","Rejected","all"] },
      },
      required: ["status"],
    },
  },
  {
    name: "update_candidate",
    description: "Update a candidate's status, notes, or other fields. status flow: New→Contacted→Interview→Offer→Hired or Rejected.",
    input_schema: {
      type: "object",
      properties: {
        id:     { type: "string" },
        patch:  { type: "object", description: "Fields: status, notes, phone, email, source, experience, cdl_class." },
        reason: { type: "string" },
      },
      required: ["id", "patch", "reason"],
    },
  },
  {
    name: "add_candidate",
    description: "Add a new driver candidate to the recruiting pipeline.",
    input_schema: {
      type: "object",
      properties: {
        name:       { type: "string" },
        phone:      { type: "string" },
        email:      { type: "string" },
        cdl_class:  { type: "string", enum: ["A","B"] },
        experience: { type: "number", description: "Years of CDL driving experience." },
        source:     { type: "string", description: "Facebook | Indeed | Referral | LinkedIn | Walk-in | Other" },
        notes:      { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_fleet_needs",
    description: "Analyze current trucks vs active drivers to determine how many drivers to hire.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "draft_outreach",
    description: "Draft a personalized outreach message for a candidate based on their profile and the carrier's real metrics.",
    input_schema: {
      type: "object",
      properties: {
        candidate_id: { type: "string" },
        channel:      { type: "string", enum: ["text","email","Facebook DM"] },
      },
      required: ["candidate_id", "channel"],
    },
  },
  {
    name: "finish",
    description: "End the workflow and return a summary.",
    input_schema: {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
    },
  },
];

export type RecruitingAction = { type: string; [k: string]: any };
export type RecruitingTrace = { tool: string; input: any; result: string };

async function runRecruitingTool(name: string, input: any, orgId: string): Promise<{ result: string; action?: RecruitingAction }> {
  switch (name) {
    case "list_candidates": {
      const status = input.status || "all";
      const rows =
        status === "all"
          ? await q("select * from candidates where org_id=$1 order by created_at desc", [orgId])
          : await q("select * from candidates where org_id=$1 and status=$2 order by created_at desc", [orgId, status]);
      return { result: JSON.stringify(rows) };
    }

    case "update_candidate": {
      const sets: string[] = [], vals: any[] = [];
      for (const [k, v] of Object.entries(input.patch || {})) {
        if (CAND_SAFE_COLS.includes(k)) {
          vals.push(v === "" ? null : v);
          sets.push(`${k}=$${vals.length}`);
        }
      }
      if (!sets.length) return { result: "No valid fields" };
      sets.push("updated_at=now()");
      vals.push(input.id);
      vals.push(orgId);
      const rows = await q(
        `update candidates set ${sets.join(",")} where id=$${vals.length - 1} and org_id=$${vals.length} returning *`,
        vals
      );
      if (!rows.length) return { result: "Candidate not found: " + input.id };
      return {
        result: JSON.stringify(rows[0]),
        action: { type: "update_candidate", id: input.id, patch: input.patch, reason: input.reason },
      };
    }

    case "add_candidate": {
      const cols = ["org_id", ...Object.keys(input).filter(k => CAND_SAFE_COLS.includes(k))];
      const vals = [orgId, ...cols.slice(1).map(k => (input[k] === "" ? null : input[k]))];
      const ph = vals.map((_, i) => `$${i + 1}`);
      const rows = await q(
        `insert into candidates (${cols.join(",")}) values (${ph.join(",")}) returning *`,
        vals
      );
      return { result: JSON.stringify(rows[0]), action: { type: "add_candidate", data: rows[0] } };
    }

    case "get_fleet_needs": {
      const loads = await q("select driver, unit, status from loads where org_id=$1", [orgId]);
      const units = new Set(loads.map((l: any) => l.unit).filter(Boolean));
      const activeDrivers = new Set(
        loads.filter((l: any) => l.status !== "Delivered").map((l: any) => l.driver).filter(Boolean)
      );
      const allDrivers = new Set(loads.map((l: any) => l.driver).filter(Boolean));
      return {
        result: JSON.stringify({
          truckCount: units.size,
          knownDrivers: allDrivers.size,
          currentlyActiveDrivers: activeDrivers.size,
          estimatedOpenSeats: Math.max(0, units.size - activeDrivers.size),
          utilizationRate: units.size ? `${Math.round((activeDrivers.size / units.size) * 100)}%` : "unknown",
        }),
      };
    }

    case "draft_outreach": {
      const rows = await q("select * from candidates where id=$1 and org_id=$2", [input.candidate_id, orgId]);
      if (!rows.length) return { result: "Candidate not found" };
      const c = rows[0];

      const loads = await q(
        "select rate, miles, rpm, pay from loads where org_id=$1 and status='Delivered' order by created_at desc limit 30",
        [orgId]
      );
      const avgRpm =
        loads.reduce((s: number, l: any) => s + (l.rpm ?? (l.rate && l.miles ? l.rate / l.miles : 0)), 0) /
        (loads.length || 1);
      const avgPay =
        loads.reduce((s: number, l: any) => s + (l.pay || 0), 0) / (loads.length || 1);

      const system =
        `You are a dispatch manager at ${await orgName(orgId)} reaching out to a CDL driver candidate. ` +
        `Write a brief, natural outreach message for ${input.channel}. ` +
        `Tone: friendly and direct — not salesy or scripted. Use first-person. ` +
        `For 'text' keep it under 160 characters. For 'email' use 3–4 sentences max. For 'Facebook DM' aim for 2–3 sentences. ` +
        `Mention real numbers (RPM, pay) where they help. ` +
        `Respond with just the message text — no subject line, no extra framing.`;

      const user =
        `Candidate: ${c.name}, CDL-${c.cdl_class || "A"}, ${c.experience ?? "?"} yrs exp, found via ${c.source || "unknown source"}.\n` +
        `Fleet averages: RPM $${avgRpm.toFixed(2)}, driver pay ~$${Math.round(avgPay)}/load.`;

      const resp = await anthropic({ max_tokens: 300, system, messages: [{ role: "user", content: user }] });
      const message = textFrom(resp.content);
      return {
        result: message,
        action: { type: "draft_outreach", candidate_id: input.candidate_id, name: c.name, channel: input.channel, message },
      };
    }

    case "finish":
      return { result: "ok", action: { type: "finish", summary: input.summary } };

    default:
      return { result: "unknown tool: " + name };
  }
}

export async function runRecruitingAgent(goal: string, orgId: string): Promise<{
  actions: RecruitingAction[];
  summary: string;
  trace: RecruitingTrace[];
}> {
  const loads = await q("select driver, unit, status from loads where org_id=$1", [orgId]);
  const units = new Set(loads.map((l: any) => l.unit).filter(Boolean));
  const active = new Set(
    loads.filter((l: any) => l.status !== "Delivered").map((l: any) => l.driver).filter(Boolean)
  );

  const system =
    `You are a driver recruiting agent for ${await orgName(orgId)}, a small carrier running ${units.size} trucks with ${active.size} active drivers. ` +
    `You manage the candidate pipeline (New→Contacted→Interview→Offer→Hired | Rejected) and draft personalised outreach. ` +
    `Be decisive: advance promising candidates, draft real messages, flag anyone who should be prioritised. ` +
    `Call finish() when done. Limit: 8 tool calls.`;

  const messages: any[] = [{ role: "user", content: goal }];
  const trace: RecruitingTrace[] = [];
  const actions: RecruitingAction[] = [];
  let summary = "";

  for (let i = 0; i < 8; i++) {
    const resp = await anthropic({ max_tokens: 2500, system, messages, tools: RECRUITING_TOOLS });
    messages.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason === "end_turn") { summary = textFrom(resp.content); break; }

    const uses: any[] = (resp.content || []).filter((c: any) => c.type === "tool_use");
    if (!uses.length) { summary = textFrom(resp.content); break; }

    const results: any[] = [];
    let done = false;
    for (const tu of uses) {
      const { result, action } = await runRecruitingTool(tu.name, tu.input, orgId);
      trace.push({ tool: tu.name, input: tu.input, result });
      if (action) {
        if (action.type === "finish") { summary = action.summary; done = true; }
        else actions.push(action);
      }
      results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
    }
    messages.push({ role: "user", content: results });
    if (done) break;
  }

  return { actions, summary, trace };
}
