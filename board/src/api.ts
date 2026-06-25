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
  if (!r.ok) {
    // Surface the backend's actual error body (e.g. "ANTHROPIC_API_KEY not set",
    // "Anthropic error 401") instead of a bare status code, so failures are diagnosable.
    let detail = "";
    try { const e = await r.json(); detail = e?.error || ""; } catch { /* non-JSON body */ }
    throw new Error(detail ? `HTTP ${r.status}: ${detail}` : `HTTP ${r.status}`);
  }
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

// Candidates
export async function getCandidates(): Promise<any[]> {
  const r = await req("/api/candidates", { headers: authHeaders() });
  return r.json();
}
export async function createCandidate(data: any): Promise<any> {
  const r = await req("/api/candidates", { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
  return r.json();
}
export async function patchCandidate(id: string, patch: any): Promise<any> {
  const r = await req("/api/candidates/" + id, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(patch) });
  return r.json();
}
export async function deleteCandidate(id: string): Promise<void> {
  await req("/api/candidates/" + id, { method: "DELETE", headers: authHeaders() });
}

// Recruiting AI
export async function generateSocialPost(platform: string, topic: string): Promise<{ post: string; hashtags: string[] }> {
  const r = await req("/api/ai/social", { method: "POST", headers: authHeaders(), body: JSON.stringify({ platform, topic }) });
  return r.json();
}
export async function runRecruitingAgent(goal: string): Promise<{ actions: any[]; summary: string; trace: any[] }> {
  const r = await req("/api/ai/recruit", { method: "POST", headers: authHeaders(), body: JSON.stringify({ goal }) });
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

// Gmail
export async function getGmailInbox(extra = "", limit = 20): Promise<any[]> {
  const qs = new URLSearchParams();
  if (extra) qs.set("q", extra);
  qs.set("limit", String(limit));
  const r = await req("/api/gmail/inbox?" + qs.toString(), { headers: authHeaders() });
  return r.json();
}
export async function getGmailThread(id: string): Promise<any> {
  const r = await req("/api/gmail/thread/" + id, { headers: authHeaders() });
  return r.json();
}
export async function saveGmailDraft(to: string, subject: string, body: string, threadId?: string, inReplyTo?: string): Promise<{ draftId: string }> {
  const r = await req("/api/gmail/draft", { method: "POST", headers: authHeaders(), body: JSON.stringify({ to, subject, body, threadId, inReplyTo }) });
  return r.json();
}
export async function composeEmail(broker: string, brokerEmail: string, context: string, loadId?: string): Promise<{ text: string }> {
  const r = await req("/api/ai/compose", { method: "POST", headers: authHeaders(), body: JSON.stringify({ broker, brokerEmail, context, loadId }) });
  return r.json();
}
export async function getGmailBrokers(): Promise<{ name: string; domains: string[]; detected: boolean }[]> {
  const r = await req("/api/gmail/brokers", { headers: authHeaders() });
  return r.json();
}

// Rate con agent pipeline
export async function getRateConQueue(): Promise<any[]> {
  const r = await req("/api/gmail/ratecons", { headers: authHeaders() });
  return r.json();
}
export async function scanRateCons(): Promise<{ scanned: number; results: any[] }> {
  const r = await req("/api/gmail/ratecons/scan", { method: "POST", headers: authHeaders(), body: "{}" });
  return r.json();
}
export async function processRateCon(threadId: string): Promise<any> {
  const r = await req("/api/gmail/ratecons/process", { method: "POST", headers: authHeaders(), body: JSON.stringify({ threadId }) });
  return r.json();
}
export async function approveRateCon(emailId: string): Promise<any> {
  const r = await req("/api/gmail/ratecons/" + emailId + "/approve", { method: "POST", headers: authHeaders(), body: "{}" });
  return r.json();
}
export async function rejectRateCon(emailId: string): Promise<void> {
  await req("/api/gmail/ratecons/" + emailId + "/reject", { method: "POST", headers: authHeaders(), body: "{}" });
}
