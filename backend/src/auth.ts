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
