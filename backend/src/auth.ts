import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

// Team password. Override in production with BOARD_PASSWORD env var; defaults to "loaded".
const PASSWORD = process.env.BOARD_PASSWORD || "loaded";
// Secret used to sign the session token. Set AUTH_SECRET in production.
const SECRET = process.env.AUTH_SECRET || "change-me-in-production";

// Deterministic token for the shared password. The same password always yields the
// same token, so a logged-in browser keeps working across restarts.
export function tokenForPassword(pw: string): string {
  return crypto.createHmac("sha256", SECRET).update("board:" + pw).digest("hex");
}
const VALID_TOKEN = tokenForPassword(PASSWORD);

export function checkPassword(pw: string): boolean {
  // constant-time compare
  const a = Buffer.from(tokenForPassword(pw));
  const b = Buffer.from(VALID_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function issueToken(): string {
  return VALID_TOKEN;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (token && token === VALID_TOKEN) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

/* ------------------------- broker portal auth ---------------------------- */
// Brokers are free-text strings on loads. We give each broker a deterministic
// 6-char access code (HMAC of its normalized name) that dispatch shares with
// them, and a signed bearer token scoped to that one broker. No broker table —
// identity is "you proved you know the code for company X", and every broker
// route filters loads to X. This is prototype-grade: production wants a real
// broker table with rotatable credentials and per-contact accounts.
function normBroker(name: string): string {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function brokerCode(name: string): string {
  return crypto.createHmac("sha256", SECRET).update("brokercode:" + normBroker(name)).digest("hex").slice(0, 6).toUpperCase();
}

export function checkBrokerCode(name: string, code: string): boolean {
  const a = Buffer.from(String(code || "").trim().toUpperCase());
  const b = Buffer.from(brokerCode(name));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function issueBrokerToken(name: string): string {
  const norm = normBroker(name);
  const sig = crypto.createHmac("sha256", SECRET).update("brokertoken:" + norm).digest("hex");
  return Buffer.from(norm + "|" + sig).toString("base64url");
}

// Returns the normalized broker name if the token is valid, else null.
export function verifyBrokerToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const idx = decoded.lastIndexOf("|");
    if (idx < 0) return null;
    const norm = decoded.slice(0, idx);
    const sig = decoded.slice(idx + 1);
    const expected = crypto.createHmac("sha256", SECRET).update("brokertoken:" + norm).digest("hex");
    const a = Buffer.from(sig), b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? norm : null;
  } catch {
    return null;
  }
}

export function requireBroker(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const broker = token ? verifyBrokerToken(token) : null;
  if (broker) { (req as any).broker = broker; return next(); }
  return res.status(401).json({ error: "Unauthorized" });
}
