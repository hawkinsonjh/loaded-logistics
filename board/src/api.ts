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

/* ── Load documents (POD/BOL photo upload) ────────────────────────────── */
export async function uploadDoc(loadId: string, payload: { kind: string; filename: string; mime: string; dataBase64: string; uploadedBy?: string }): Promise<any> {
  const r = await req("/api/loads/" + loadId + "/docs", { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
  return r.json();
}
export async function getLoadDocs(loadId: string): Promise<any[]> {
  const r = await req("/api/loads/" + loadId + "/docs", { headers: authHeaders() });
  return r.json();
}

/* ── Broker portal (per-broker token, separate from the team token) ───── */
const BTOKEN_KEY = "ll_broker_token";
const BNAME_KEY = "ll_broker_name";
export function brokerToken(): string { return localStorage.getItem(BTOKEN_KEY) || ""; }
export function brokerName(): string { return localStorage.getItem(BNAME_KEY) || ""; }
export function brokerLogout() { localStorage.removeItem(BTOKEN_KEY); localStorage.removeItem(BNAME_KEY); }
export async function brokerLogin(broker: string, code: string): Promise<{ token: string; broker: string }> {
  const r = await fetch(BASE + "/api/broker/login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ broker, code }),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Login failed"); }
  const d = await r.json();
  localStorage.setItem(BTOKEN_KEY, d.token);
  localStorage.setItem(BNAME_KEY, d.broker);
  return d;
}
export async function getBrokerLoads(): Promise<any[]> {
  const r = await fetch(BASE + "/api/broker/loads", { headers: { Authorization: "Bearer " + brokerToken() } });
  if (r.status === 401) { brokerLogout(); throw new Error("HTTP 401"); }
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
export async function getBrokerCodes(): Promise<any[]> {
  const r = await req("/api/broker/codes", { headers: authHeaders() });
  return r.json();
}

/* ── Public shipment tracking (no auth — Customer Portal) ─────────────── */
export async function trackLoad(ref: string): Promise<any> {
  const r = await fetch(BASE + "/api/track/" + encodeURIComponent(ref.trim()));
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Shipment not found"); }
  return r.json();
}

/* ── Phase 2: Gmail inbox ─────────────────────────────────────────────── */
export async function getEmails(): Promise<any[]> {
  const r = await req("/api/emails", { headers: authHeaders() });
  return r.json();
}
export async function getIngestStatus(): Promise<any> {
  const r = await req("/api/ingest/status", { headers: authHeaders() });
  return r.json();
}
export async function runIngest(): Promise<any> {
  const r = await req("/api/ingest/run", { method: "POST", headers: authHeaders() });
  return r.json();
}
export async function promoteEmail(id: string): Promise<any> {
  const r = await req("/api/emails/" + id + "/promote", { method: "POST", headers: authHeaders() });
  return r.json();
}

/* ── Phase 3: IFTA / fuel ─────────────────────────────────────────────── */
export async function getFuel(): Promise<any[]> {
  const r = await req("/api/fuel", { headers: authHeaders() });
  return r.json();
}
export async function addFuel(f: any): Promise<any> {
  const r = await req("/api/fuel", { method: "POST", headers: authHeaders(), body: JSON.stringify(f) });
  return r.json();
}
export async function deleteFuel(id: string): Promise<void> {
  await req("/api/fuel/" + id, { method: "DELETE", headers: authHeaders() });
}
export async function getIftaMiles(quarter: string): Promise<any[]> {
  const r = await req("/api/ifta/miles?quarter=" + encodeURIComponent(quarter), { headers: authHeaders() });
  return r.json();
}
export async function setIftaMiles(quarter: string, jurisdiction: string, miles: number): Promise<void> {
  await req("/api/ifta/miles", { method: "PUT", headers: authHeaders(), body: JSON.stringify({ quarter, jurisdiction, miles }) });
}
