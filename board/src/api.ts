// API client for the Loaded Logistics board.
// Set VITE_API_URL to your deployed backend URL (e.g. https://loaded-api.up.railway.app).
const BASE: string = (import.meta as any).env?.VITE_API_URL || "";

const TOKEN_KEY = "ll_token";
export function token(): string { return localStorage.getItem(TOKEN_KEY) || ""; }
export function logout() { localStorage.removeItem(TOKEN_KEY); }

function authHeaders(): Record<string, string> {
  return { Authorization: "Bearer " + token(), "Content-Type": "application/json" };
}
async function req(path: string, opts: RequestInit = {}) {
  const r = await fetch(BASE + path, opts);
  if (r.status === 401) { logout(); throw new Error("HTTP 401"); }
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r;
}

export async function login(password: string): Promise<string | null> {
  const r = await fetch(BASE + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  localStorage.setItem(TOKEN_KEY, d.token);
  return d.token;
}

export async function getLoads(): Promise<any[]> {
  const r = await req("/api/loads", { headers: authHeaders() });
  return r.json();
}
export async function createLoad(load: any): Promise<any> {
  const r = await req("/api/loads", { method: "POST", headers: authHeaders(), body: JSON.stringify(load) });
  return r.json();
}
export async function patchLoad(id: string, patch: any): Promise<any> {
  const r = await req("/api/loads/" + id, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(patch) });
  return r.json();
}
export async function deleteLoad(id: string): Promise<void> {
  await req("/api/loads/" + id, { method: "DELETE", headers: authHeaders() });
}

export async function getMessages(): Promise<any[]> {
  const r = await req("/api/messages", { headers: authHeaders() });
  return r.json();
}
export async function postMessage(m: any): Promise<any> {
  const r = await req("/api/messages", { method: "POST", headers: authHeaders(), body: JSON.stringify(m) });
  return r.json();
}

function parseJSON(text: string): any {
  let t = (text || "").trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b >= 0) t = t.slice(a, b + 1);
  return JSON.parse(t);
}
export async function extractLoad(text: string): Promise<any> {
  const r = await fetch(BASE + "/api/ai/extract", { method: "POST", headers: authHeaders(), body: JSON.stringify({ text }) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "extract failed"); }
  const d = await r.json();
  return parseJSON(d.text);
}
export async function copilotReply(messages: any[], context: any): Promise<string> {
  const r = await fetch(BASE + "/api/ai/copilot", { method: "POST", headers: authHeaders(), body: JSON.stringify({ messages, context }) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "copilot failed"); }
  const d = await r.json();
  return d.text;
}

export async function runAnalysis(): Promise<{ summary: string; flags: string[]; opportunities: string[] }> {
  const r = await req("/api/ai/analyze", { method: "POST", headers: authHeaders(), body: JSON.stringify({}) });
  return r.json();
}

export async function runExecutorWorkflow(goal: string): Promise<{
  actions: { type: string; id?: string; patch?: any; reason?: string; body?: string; load_id?: string }[];
  summary: string;
  trace: { tool: string; input: any; result: string }[];
}> {
  const r = await req("/api/ai/execute", { method: "POST", headers: authHeaders(), body: JSON.stringify({ goal }) });
  return r.json();
}
