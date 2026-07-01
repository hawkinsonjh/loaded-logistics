import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { q } from "./db.js";
import { DEFAULT_ORG_ID, TRIAL_DAYS } from "./plans.js";

// Secret used to sign session tokens. Set AUTH_SECRET in production.
const SECRET = process.env.AUTH_SECRET || "change-me-in-production";

// Legacy shared team password — keeps Joe's existing team logged in. New
// customers use real email/password accounts. Defaults to "loaded".
const LEGACY_PASSWORD = process.env.BOARD_PASSWORD || "loaded";

/* ============================ PASSWORD HASHING ============================ */
// scrypt via Node's built-in crypto — no external dependency. Stored as "salt:hashHex".

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const known = Buffer.from(hash, "hex");
  return test.length === known.length && crypto.timingSafeEqual(test, known);
}

/* ============================ SIGNED TOKENS ============================ */
// Compact stateless token: base64url(payload).hmacSig. Carries the user + org so
// every request is tenant-scoped without a session lookup. 30-day expiry.

export interface AuthPayload {
  uid: string;     // user id ("legacy" for shared-password sessions)
  oid: string;     // org id
  role: string;    // owner | dispatcher
  exp: number;     // epoch ms
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function signToken(p: Omit<AuthPayload, "exp">, ttlMs = THIRTY_DAYS): string {
  const payload: AuthPayload = { ...p, exp: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string): AuthPayload | null {
  const [body, sig] = (token || "").split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  // constant-time compare of signatures
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p: AuthPayload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

/* ============================ ACCOUNT OPERATIONS ============================ */

export interface SessionUser {
  id: string;
  orgId: string;
  email: string;
  name: string | null;
  role: string;
  token: string;
}

// Create a brand-new org + owner user in one shot. Used by signup.
export async function createOrgWithOwner(opts: {
  orgName: string;
  email: string;
  password: string;
  name?: string;
}): Promise<SessionUser> {
  const email = opts.email.trim().toLowerCase();
  const existing = await q("select id from users where lower(email)=$1", [email]);
  if (existing.length) throw new Error("An account with that email already exists");

  const orgRows = await q(
    `insert into orgs (name, plan, plan_status, trial_ends_at, truck_limit)
     values ($1,'trial','trialing', now() + ($2 || ' days')::interval, 5)
     returning id`,
    [opts.orgName.trim() || "My Carrier", String(TRIAL_DAYS)],
  );
  const orgId = orgRows[0].id;

  const userRows = await q(
    `insert into users (org_id, email, name, password_hash, role)
     values ($1,$2,$3,$4,'owner') returning id, email, name, role`,
    [orgId, email, opts.name?.trim() || null, hashPassword(opts.password)],
  );
  const u = userRows[0];
  const token = signToken({ uid: u.id, oid: orgId, role: u.role });
  return { id: u.id, orgId, email: u.email, name: u.name, role: u.role, token };
}

// Authenticate an email/password account.
export async function loginUser(email: string, password: string): Promise<SessionUser | null> {
  const rows = await q(
    "select id, org_id, email, name, role, password_hash from users where lower(email)=$1",
    [email.trim().toLowerCase()],
  );
  if (!rows.length) return null;
  const u = rows[0];
  if (!verifyPassword(password, u.password_hash)) return null;
  const token = signToken({ uid: u.id, oid: u.org_id, role: u.role });
  return { id: u.id, orgId: u.org_id, email: u.email, name: u.name, role: u.role, token };
}

/* ============================ LEGACY SHARED PASSWORD ============================ */
// Joe's existing team logs in with the shared BOARD_PASSWORD. That session is
// scoped to the default org so all of his historical data keeps working.

export function checkLegacyPassword(pw: string): boolean {
  const a = Buffer.from(pw || "");
  const b = Buffer.from(LEGACY_PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function legacyToken(): string {
  return signToken({ uid: "legacy", oid: DEFAULT_ORG_ID, role: "owner" });
}

/* ============================ MIDDLEWARE ============================ */

// Adds `auth` to the request type.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      orgId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Unauthorized" });
  req.auth = payload;
  req.orgId = payload.oid;
  next();
}
