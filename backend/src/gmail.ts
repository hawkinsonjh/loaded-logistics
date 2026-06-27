// Gmail read-only client for the Phase 2 ingest worker.
//
// Talks to the Gmail REST API directly with fetch (no SDK) — the backend already
// uses fetch for Anthropic, so there are no extra dependencies to install. Each
// inbox is accessed with its own refresh token (scope: gmail.readonly — it can
// read, never send or modify). Finds rate-con-looking emails, pulls the body
// text, and downloads any PDF attachments as base64 for the shared extractor.

export interface MailAccount {
  email: string;
  refreshToken: string;
}

export interface PdfPart {
  filename: string;
  data: string; // standard base64
}

export interface FetchedMessage {
  gmailId: string;
  mailbox: string;
  from: string;
  subject: string;
  receivedAt: Date;
  bodyText: string;
  pdfs: PdfPart[];
}

/** Parse GMAIL_ACCOUNTS (a JSON array of {email, refreshToken}) from the env. */
export function getAccounts(): MailAccount[] {
  const raw = process.env.GMAIL_ACCOUNTS;
  if (!raw) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("GMAIL_ACCOUNTS is not valid JSON — ignoring.");
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((a) => a && a.email && a.refreshToken)
    .map((a) => ({ email: String(a.email), refreshToken: String(a.refreshToken) }));
}

/** True when the Google app credentials AND at least one mailbox are present. */
export function ingestConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && getAccounts().length);
}

/* ----------------------------- OAuth tokens ------------------------------ */
// Short-lived access tokens are cached per refresh token until ~1 min before expiry.
const tokenCache = new Map<string, { access: string; exp: number }>();

export async function accessTokenFor(refreshToken: string): Promise<string> {
  const cached = tokenCache.get(refreshToken);
  if (cached && cached.exp > Date.now() + 60000) return cached.access;

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    const d = await r.text().catch(() => "");
    throw new Error("token refresh failed " + r.status + (d ? " " + d.slice(0, 200) : ""));
  }
  const d: any = await r.json();
  const access = d.access_token as string;
  const exp = Date.now() + (d.expires_in ? d.expires_in * 1000 : 3600000);
  tokenCache.set(refreshToken, { access, exp });
  return access;
}

async function gmailGet(account: MailAccount, path: string, params?: Record<string, string>): Promise<any> {
  const token = await accessTokenFor(account.refreshToken);
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/" + path);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) {
    const d = await r.text().catch(() => "");
    throw new Error("gmail " + path + " " + r.status + (d ? " " + d.slice(0, 200) : ""));
  }
  return r.json();
}

// Recent emails that read like a rate confirmation. Override with GMAIL_QUERY.
// The AI still confirms is_rate_con on every candidate, so this can be loose.
export function searchQuery(): string {
  return (
    process.env.GMAIL_QUERY ||
    'newer_than:3d ("rate confirmation" OR "rate con" OR "load confirmation" OR "carrier confirmation" OR "load tender" OR "rate and load confirmation")'
  );
}

export async function listCandidateIds(a: MailAccount, max = 25): Promise<string[]> {
  const data = await gmailGet(a, "messages", { q: searchQuery(), maxResults: String(max) });
  return (data.messages || []).map((m: any) => m.id).filter(Boolean);
}

/* --------------------------- message parsing ----------------------------- */
export function b64urlToBuf(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function header(headers: any[], name: string): string {
  const h = (headers || []).find((x) => (x.name || "").toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

// Walk the MIME tree, collecting plain text, html, and PDF attachment refs.
export function walk(
  part: any,
  acc: { texts: string[]; htmls: string[]; pdfs: { filename: string; attachmentId: string }[] }
) {
  if (!part) return;
  const mime = part.mimeType || "";
  const filename = part.filename || "";
  if (mime === "text/plain" && part.body?.data) acc.texts.push(b64urlToBuf(part.body.data).toString("utf8"));
  else if (mime === "text/html" && part.body?.data) acc.htmls.push(b64urlToBuf(part.body.data).toString("utf8"));
  if ((mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) && part.body?.attachmentId) {
    acc.pdfs.push({ filename: filename || "rate-con.pdf", attachmentId: part.body.attachmentId });
  }
  for (const p of part.parts || []) walk(p, acc);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchMessage(a: MailAccount, gmailId: string): Promise<FetchedMessage> {
  const msg: any = await gmailGet(a, "messages/" + gmailId, { format: "full" });
  const headers = msg.payload?.headers || [];

  const acc = { texts: [] as string[], htmls: [] as string[], pdfs: [] as { filename: string; attachmentId: string }[] };
  walk(msg.payload, acc);

  let bodyText = acc.texts.join("\n").trim();
  if (!bodyText && acc.htmls.length) bodyText = stripHtml(acc.htmls.join("\n"));
  if (!bodyText && msg.snippet) bodyText = msg.snippet;
  if (bodyText.length > 12000) bodyText = bodyText.slice(0, 12000);

  // Download up to 3 PDFs (rate cons are tiny; this just caps pathological cases).
  const pdfs: PdfPart[] = [];
  for (const p of acc.pdfs.slice(0, 3)) {
    try {
      const at = await gmailGet(a, `messages/${gmailId}/attachments/${p.attachmentId}`);
      if (at.data) pdfs.push({ filename: p.filename, data: b64urlToBuf(at.data).toString("base64") });
    } catch {
      /* skip an unreadable attachment rather than failing the whole message */
    }
  }

  const dateMs = msg.internalDate ? parseInt(msg.internalDate, 10) : Date.now();
  return {
    gmailId,
    mailbox: a.email,
    from: header(headers, "From"),
    subject: header(headers, "Subject"),
    receivedAt: new Date(dateMs),
    bodyText,
    pdfs,
  };
}
