// Gmail REST API integration — OAuth refresh token flow.
// Required env vars: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const MY_EMAIL = () => process.env.GMAIL_USER_EMAIL || "hawkinsonjh@gmail.com";

// In-memory token cache (expires_in is usually 3600s)
let cachedToken: { token: string; expires: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error("Gmail env vars not configured (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)");
  }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!r.ok) throw new Error("OAuth token refresh failed: " + r.status);
  const d: any = await r.json();
  if (d.error) throw new Error("OAuth error: " + d.error_description);
  const expiresIn = d.expires_in || 3600;
  cachedToken = { token: d.access_token, expires: Date.now() + (expiresIn - 60) * 1000 };
  return cachedToken.token;
}

async function gmailReq(path: string, opts: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  const r = await fetch(GMAIL_API + path, {
    ...opts,
    headers: { ...(opts.headers as Record<string, string> || {}), Authorization: "Bearer " + token },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error("Gmail API " + r.status + ": " + body.slice(0, 200));
  }
  if (r.status === 204) return {};
  return r.json();
}

// Broker domain cross-reference table
export const BROKER_DOMAINS: Record<string, string[]> = {
  "TQL":                ["tql.com"],
  "RXO":                ["rxo.com", "xpo.com/freight"],
  "MegaCorp":           ["megacorplogistics.com"],
  "Armstrong":          ["armstrongtransport.com", "powerhouselogistics.com"],
  "Echo":               ["echo.com", "echogloballogistics.com"],
  "Coyote":             ["coyote.com"],
  "CH Robinson":        ["chrobinson.com"],
  "Transplace":         ["transplace.com"],
  "Uber Freight":       ["uberfreight.com"],
  "Convoy":             ["convoy.com"],
  "GlobalTranz":        ["globaltranz.com"],
  "Mode":               ["modeglobal.com"],
};

// Trusted contacts whose emails bypass subject-keyword filtering and auto-approve on the board.
// hello@highway.com is Armstrong's automated rate-con delivery system.
export const TRUSTED_RATECON_SENDERS: Record<string, string> = {
  "tschaefer@armstrongtransport.com": "Armstrong",
  "jortiz@armstrongtransport.com":    "Armstrong",
  "julia@powerhouselogistics.com":    "Armstrong",
  "tucker@powerhouselogistics.com":   "Armstrong",
  "hello@highway.com":                "Armstrong",
};

export function isTrustedRateConSender(emailAddr: string): boolean {
  const lc = emailAddr.toLowerCase();
  return Object.keys(TRUSTED_RATECON_SENDERS).some(e => lc.includes(e));
}

// Build a Gmail search that targets trusted senders without subject filters
export function buildTrustedSenderQuery(): string {
  const senders = Object.keys(TRUSTED_RATECON_SENDERS);
  const fromParts = senders.map(e => `from:${e}`).join(" OR ");
  return `(${fromParts}) newer_than:30d`;
}

export function detectBroker(emailAddr: string): string | null {
  const lc = emailAddr.toLowerCase();
  // Check trusted senders first for exact matches
  for (const [email, broker] of Object.entries(TRUSTED_RATECON_SENDERS)) {
    if (lc.includes(email)) return broker;
  }
  for (const [broker, domains] of Object.entries(BROKER_DOMAINS)) {
    if (domains.some(d => lc.includes(d))) return broker;
  }
  return null;
}

// Build a Gmail search query that targets all known broker domains
export function buildBrokerQuery(extra = ""): string {
  const domains = Object.values(BROKER_DOMAINS).flat();
  const fromParts = domains.map(d => `from:${d}`).join(" OR ");
  const base = `(${fromParts})`;
  return extra ? `${base} ${extra}` : base;
}

// Decode base64url content from Gmail API
function decodeBody(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf-8");
}

function extractText(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBody(payload.body.data);
  if (payload.parts) {
    for (const p of payload.parts) {
      if (p.mimeType === "text/plain" && p.body?.data) return decodeBody(p.body.data);
    }
    for (const p of payload.parts) {
      const t = extractText(p);
      if (t) return t;
    }
  }
  return "";
}

function hdr(headers: any[], name: string): string {
  return (headers || []).find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  isFromMe: boolean;
}

export interface ThreadSummary {
  id: string;
  subject: string;
  snippet: string;
  broker: string | null;
  fromAddr: string;
  lastDate: string;
  messageCount: number;
}

export interface GmailThread extends ThreadSummary {
  messages: GmailMessage[];
}

function isFromMe(from: string): boolean {
  const me = MY_EMAIL().toLowerCase();
  const lc = from.toLowerCase();
  return lc.includes(me) || lc.includes("loadedlogisticsnc.com") ||
    lc.includes("joseph hawkinson") || lc.includes("joe hawkinson");
}

function parseMessage(m: any): GmailMessage {
  const headers = m.payload?.headers || [];
  const from = hdr(headers, "From");
  const to = hdr(headers, "To");
  const subject = hdr(headers, "Subject");
  const date = hdr(headers, "Date");
  const body = extractText(m.payload).trim();
  return {
    id: m.id,
    threadId: m.threadId,
    from, to, subject, date,
    snippet: (m.snippet || "").replace(/&amp;/g, "&").replace(/&#39;/g, "'"),
    body: body.slice(0, 4000),
    isFromMe: isFromMe(from),
  };
}

export async function searchInbox(q: string, maxResults = 20): Promise<ThreadSummary[]> {
  const data = await gmailReq(
    `/users/me/threads?q=${encodeURIComponent(q)}&maxResults=${maxResults}&labelIds=INBOX`
  );
  if (!data.threads?.length) return [];

  const results: ThreadSummary[] = [];
  for (const t of data.threads) {
    try {
      const td = await gmailReq(`/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
      const messages = td.messages || [];
      const first = messages[0] || {};
      const last = messages[messages.length - 1] || {};
      const firstHeaders = first.payload?.headers || [];
      const lastHeaders = last.payload?.headers || [];
      // The broker is the first message in the thread NOT sent by Joe. Many threads are
      // started by Joe (cold-emailing brokers about DAT loads), so messages[0] is often
      // Joe himself — fall back to scanning for the first counterparty message.
      const brokerFrom = messages
        .map((m: any) => hdr(m.payload?.headers || [], "From"))
        .find((f: string) => f && !isFromMe(f));
      const fromAddr = brokerFrom || hdr(firstHeaders, "From");
      results.push({
        id: t.id,
        subject: hdr(firstHeaders, "Subject") || "(no subject)",
        snippet: (td.snippet || "").replace(/&amp;/g, "&").replace(/&#39;/g, "'"),
        broker: detectBroker(fromAddr),
        fromAddr,
        lastDate: hdr(lastHeaders, "Date"),
        messageCount: messages.length,
      });
    } catch { /* skip threads that fail */ }
  }
  return results;
}

export async function getThread(threadId: string): Promise<GmailThread> {
  const data = await gmailReq(`/users/me/threads/${threadId}?format=full`);
  const messages = (data.messages || []).map(parseMessage);
  const brokerMsg = messages.find(m => !m.isFromMe);
  const lastMsg = messages[messages.length - 1];
  const fromAddr = brokerMsg?.from || messages[0]?.from || "";
  return {
    id: threadId,
    subject: messages[0]?.subject || "(no subject)",
    snippet: lastMsg?.snippet || "",
    broker: detectBroker(fromAddr),
    fromAddr,
    lastDate: lastMsg?.date || "",
    messageCount: messages.length,
    messages,
  };
}

export async function createDraft(
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string,
  references?: string,
  threadId?: string,
): Promise<string> {
  const lines: string[] = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
  ];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push("", body);

  const raw = Buffer.from(lines.join("\r\n")).toString("base64url");
  const payload: any = { message: { raw } };
  if (threadId) payload.message.threadId = threadId;

  const data = await gmailReq("/users/me/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.id;
}

// Fetch recent sent messages for a broker (style analysis)
export async function fetchStyleExamples(brokerEmail: string, limit = 8): Promise<string[]> {
  const domain = brokerEmail.split("@")[1];
  const q = domain ? `to:${domain} in:sent` : `to:${brokerEmail} in:sent`;
  const data = await gmailReq(
    `/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${limit}`
  ).catch(() => ({ messages: [] }));
  if (!data.messages?.length) return [];

  const examples: string[] = [];
  for (const m of data.messages.slice(0, limit)) {
    try {
      const full = await gmailReq(`/users/me/messages/${m.id}?format=full`);
      const body = extractText(full.payload).trim();
      if (body.length > 10) examples.push(body.slice(0, 800));
    } catch { /* skip */ }
  }
  return examples;
}
