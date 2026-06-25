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

/* ===================== FLEET METRICS ===================== */

function fleetMetrics(loads: any[]) {
  let rev = 0, miles = 0, rpmN = 0, rpmC = 0;
  let pay = 0, fuel = 0, disp = 0, rep = 0;
  const thinActive: string[] = [];
  const driverActive = new Set<string>();
  const driverSeen = new Set<string>();
  const byStatus: Record<string, number> = {};

  loads.forEach(l => {
    rev += l.rate || 0;
    miles += l.miles || 0;
    pay += l.pay || 0;
    fuel += l.fuel || 0;
    disp += l.dispatch || 0;
    rep += l.repair || 0;
    const rpm: number | null = l.rpm ?? (l.rate && l.miles ? l.rate / l.miles : null);
    if (rpm != null) { rpmN += rpm; rpmC++; }
    if (l.driver) {
      driverSeen.add(l.driver);
      if (l.status !== "Delivered") driverActive.add(l.driver);
    }
    if (rpm != null && rpm < 1.8 && l.status !== "Delivered") thinActive.push(l.broker || l.id);
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
  });

  return {
    totalRevenue: Math.round(rev),
    netMargin: Math.round(rev - pay - fuel - disp - rep),
    avgRpm: rpmC ? +(rpmN / rpmC).toFixed(2) : null,
    totalMiles: Math.round(miles),
    activeLoads: loads.filter(l => l.status !== "Delivered").length,
    totalLoads: loads.length,
    loadsByStatus: byStatus,
    thinMarginActiveLoads: thinActive,
    driversActive: Array.from(driverActive),
    driversIdle: Array.from(driverSeen).filter(d => !driverActive.has(d)),
  };
}

/* ===================== ANALYST AGENT ===================== */
// Read-only. Fetches all loads, computes metrics, asks Claude for a critique.

export async function runAnalyst(): Promise<{
  summary: string;
  flags: string[];
  opportunities: string[];
}> {
  const loads = await q("select * from loads order by created_at desc");
  const metrics = fleetMetrics(loads);

  const system =
    "You are a freight dispatch analyst for a small carrier. Study the fleet state and produce a concise operational critique. " +
    "RPM thresholds: <$1.80 thin, $1.80–$2.49 ok, $2.50+ strong. Net = rate − pay − fuel − dispatch − repair. " +
    "Respond ONLY with a JSON object: { summary: string, flags: string[], opportunities: string[] }. " +
    "flags = specific risks or problems (max 6, ≤15 words each). opportunities = actionable improvements (max 6, ≤15 words each).";

  const user =
    "Fleet metrics:\n" + JSON.stringify(metrics, null, 2) +
    "\n\nActive loads:\n" +
    JSON.stringify(
      loads
        .filter(l => l.status !== "Delivered")
        .map(l => ({
          id: l.id, broker: l.broker, status: l.status,
          driver: l.driver, unit: l.unit,
          rate: l.rate, miles: l.miles,
          rpm: l.rpm ?? (l.rate && l.miles ? +(l.rate / l.miles).toFixed(2) : null),
          net: Math.round((l.rate || 0) - (l.pay || 0) - (l.fuel || 0) - (l.dispatch || 0) - (l.repair || 0)),
        })),
      null, 2
    );

  const resp = await anthropic({ max_tokens: 1200, system, messages: [{ role: "user", content: user }] });
  const raw = textFrom(resp.content);

  try {
    const j = parseJSON(raw);
    return { summary: j.summary || "", flags: j.flags || [], opportunities: j.opportunities || [] };
  } catch {
    return { summary: raw, flags: [], opportunities: [] };
  }
}

/* ===================== EXECUTOR AGENT ===================== */
// Agentic tool-use loop. Reads the board, makes real DB changes, posts messages.

const TOOLS = [
  {
    name: "list_loads",
    description: "Get loads from the board filtered by status.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["Available", "Assigned", "In Transit", "Delivered", "all"] },
      },
      required: ["status"],
    },
  },
  {
    name: "patch_load",
    description:
      "Update fields on a load. To assign a driver to an Available load you MUST also set status='Assigned'. " +
      "Common fields: status, driver, unit, rate, miles, pay, fuel, dispatch, repair.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        patch: { type: "object" },
        reason: { type: "string" },
      },
      required: ["id", "patch", "reason"],
    },
  },
  {
    name: "post_message",
    description: "Post a message to the team channel. Optionally tag a load by UUID.",
    input_schema: {
      type: "object",
      properties: {
        body: { type: "string" },
        load_id: { type: "string" },
      },
      required: ["body"],
    },
  },
  {
    name: "get_driver_stats",
    description: "Return per-driver aggregate stats: load count, avg RPM, total revenue, current active load.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "finish",
    description: "Signal the workflow is complete and return a summary of what was accomplished.",
    input_schema: {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
    },
  },
];

const SAFE_PATCH_COLS = [
  "status", "driver", "unit", "rate", "miles", "rpm",
  "pay", "fuel", "dispatch", "repair", "broker", "origin", "dest", "date", "ref",
];

export type TraceEntry = { tool: string; input: any; result: string };
export type Action = { type: string; [k: string]: any };

async function runTool(name: string, input: any): Promise<{ result: string; action?: Action }> {
  switch (name) {
    case "list_loads": {
      const status = input.status || "all";
      const rows =
        status === "all"
          ? await q(
              "select id, broker, status, driver, unit, rate, miles, rpm, origin, dest, pay, fuel, dispatch, repair from loads order by created_at desc"
            )
          : await q(
              "select id, broker, status, driver, unit, rate, miles, rpm, origin, dest, pay, fuel, dispatch, repair from loads where status=$1 order by created_at desc",
              [status]
            );
      return {
        result: JSON.stringify(
          rows.map(l => ({
            ...l,
            rpm: l.rpm ?? (l.rate && l.miles ? +(l.rate / l.miles).toFixed(2) : null),
          }))
        ),
      };
    }

    case "patch_load": {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(input.patch || {})) {
        if (SAFE_PATCH_COLS.includes(k)) {
          vals.push(v === "" ? null : v);
          sets.push(`${k}=$${vals.length}`);
        }
      }
      if (!sets.length) return { result: "No valid fields to update" };
      sets.push("updated_at=now()");
      vals.push(input.id);
      const rows = await q(
        `update loads set ${sets.join(",")} where id=$${vals.length} returning id, broker, status, driver, unit, rate, miles`,
        vals
      );
      if (!rows.length) return { result: "Load not found: " + input.id };
      return {
        result: JSON.stringify(rows[0]),
        action: { type: "patch_load", id: input.id, patch: input.patch, reason: input.reason, result: rows[0] },
      };
    }

    case "post_message": {
      const rows = await q(
        `insert into messages (who, body, tag) values ($1,$2,$3) returning id`,
        ["Dispatch AI", input.body, input.load_id || null]
      );
      return {
        result: "posted:" + rows[0].id,
        action: { type: "post_message", body: input.body, load_id: input.load_id || null },
      };
    }

    case "get_driver_stats": {
      const loads = await q(
        "select driver, status, rate, miles, rpm, broker from loads"
      );
      const m: Record<string, any> = {};
      loads.forEach(l => {
        if (!l.driver) return;
        const d = m[l.driver] || (m[l.driver] = { driver: l.driver, loads: 0, rev: 0, rpmN: 0, rpmC: 0, active: null });
        d.loads++;
        d.rev += l.rate || 0;
        const rpm: number | null = l.rpm ?? (l.rate && l.miles ? l.rate / l.miles : null);
        if (rpm) { d.rpmN += rpm; d.rpmC++; }
        if (l.status !== "Delivered") d.active = { status: l.status, broker: l.broker };
      });
      const stats = Object.values(m).map((d: any) => ({
        ...d,
        avgRpm: d.rpmC ? +(d.rpmN / d.rpmC).toFixed(2) : null,
      }));
      return { result: JSON.stringify(stats) };
    }

    case "finish":
      return { result: "ok", action: { type: "finish", summary: input.summary } };

    default:
      return { result: "unknown tool: " + name };
  }
}

export async function runExecutor(goal: string): Promise<{
  actions: Action[];
  summary: string;
  trace: TraceEntry[];
}> {
  const system =
    "You are an autonomous freight dispatch executor for a small carrier. Use tools to accomplish the given goal, then call finish(). " +
    "Load lifecycle: Available→Assigned→In Transit→Delivered. Always set status=Assigned when assigning a driver. " +
    "RPM <$1.80 thin, $1.80–$2.49 ok, $2.50+ strong. " +
    "Be decisive — make actual changes, don't just report. Limit to 8 tool calls.";

  const messages: any[] = [{ role: "user", content: goal }];
  const trace: TraceEntry[] = [];
  const actions: Action[] = [];
  let summary = "";

  for (let i = 0; i < 8; i++) {
    const resp = await anthropic({ max_tokens: 2500, system, messages, tools: TOOLS });
    messages.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason === "end_turn") {
      summary = textFrom(resp.content);
      break;
    }

    const uses: any[] = (resp.content || []).filter((c: any) => c.type === "tool_use");
    if (!uses.length) {
      summary = textFrom(resp.content);
      break;
    }

    const results: any[] = [];
    let done = false;
    for (const tu of uses) {
      const { result, action } = await runTool(tu.name, tu.input);
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
