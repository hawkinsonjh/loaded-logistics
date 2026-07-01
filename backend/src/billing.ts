// Stripe billing — checkout, customer portal, webhook sync, plan gating.
//
// Designed to degrade gracefully: if STRIPE_SECRET_KEY is unset (e.g. Joe's
// internal deployment, or local dev), billing endpoints return a clear error
// and the rest of the app keeps working on the free trial.

import Stripe from "stripe";
import { q } from "./db.js";
import { PLANS, planById, type PlanId } from "./plans.js";

let _stripe: Stripe | null = null;
function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new Error("Billing not configured (STRIPE_SECRET_KEY not set)");
  _stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  return _stripe;
}

export function billingConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY || "").trim();
}

const APP_URL = () => process.env.APP_URL || "http://localhost:5173";

// Ensure the org has a Stripe customer; create one lazily on first checkout.
async function ensureCustomer(orgId: string): Promise<string> {
  const rows = await q("select id, name, stripe_customer_id from orgs where id=$1", [orgId]);
  if (!rows.length) throw new Error("Org not found");
  const org = rows[0];
  if (org.stripe_customer_id) return org.stripe_customer_id;

  // Use the owner's email for the customer record
  const owner = await q(
    "select email from users where org_id=$1 and role='owner' order by created_at asc limit 1",
    [orgId],
  );
  const customer = await stripe().customers.create({
    name: org.name,
    email: owner[0]?.email,
    metadata: { orgId },
  });
  await q("update orgs set stripe_customer_id=$1, updated_at=now() where id=$2", [customer.id, orgId]);
  return customer.id;
}

// Create a Checkout session to subscribe an org to a paid plan.
export async function createCheckoutSession(orgId: string, planId: PlanId): Promise<string> {
  const plan = PLANS[planId];
  if (!plan || plan.id === "trial") throw new Error("Pick a paid plan");
  const priceId = (process.env[plan.stripePriceEnv] || "").trim();
  if (!priceId) throw new Error(`Missing Stripe price for ${plan.name} (set ${plan.stripePriceEnv})`);

  const customerId = await ensureCustomer(orgId);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL()}/?billing=success`,
    cancel_url: `${APP_URL()}/?billing=cancel`,
    subscription_data: { metadata: { orgId, planId } },
    metadata: { orgId, planId },
    allow_promotion_codes: true,
  });
  return session.url || "";
}

// Stripe-hosted portal so customers can update card / cancel — no contract lock-in.
export async function createPortalSession(orgId: string): Promise<string> {
  const customerId = await ensureCustomer(orgId);
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL()}/?tab=billing`,
  });
  return session.url;
}

// Map a Stripe price id back to our plan id.
function planForPrice(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  for (const p of Object.values(PLANS)) {
    if (p.stripePriceEnv && (process.env[p.stripePriceEnv] || "").trim() === priceId) return p.id;
  }
  return null;
}

async function applySubscription(orgId: string, planId: PlanId, status: string, subId?: string) {
  const limit = planById(planId).truckLimit;
  await q(
    `update orgs set plan=$1, plan_status=$2, truck_limit=$3,
       stripe_subscription_id=coalesce($4, stripe_subscription_id), updated_at=now()
     where id=$5`,
    [planId, status, limit, subId || null, orgId],
  );
}

// Verify + process a Stripe webhook. `rawBody` must be the unparsed request body.
export async function handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not set");
  const event = stripe().webhooks.constructEvent(rawBody, signature, secret);

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const orgId = s.metadata?.orgId;
      const planId = (s.metadata?.planId as PlanId) || null;
      if (orgId && planId) {
        await applySubscription(orgId, planId, "active", (s.subscription as string) || undefined);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId || (await orgByCustomer(sub.customer as string));
      const priceId = sub.items.data[0]?.price?.id;
      const planId = (sub.metadata?.planId as PlanId) || planForPrice(priceId);
      if (orgId && planId) {
        const status = sub.status === "active" || sub.status === "trialing" ? "active" : sub.status;
        await applySubscription(orgId, planId, status, sub.id);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId || (await orgByCustomer(sub.customer as string));
      if (orgId) {
        // Downgrade to trial-locked state; keep their data.
        await q(
          "update orgs set plan='trial', plan_status='canceled', truck_limit=5, updated_at=now() where id=$1",
          [orgId],
        );
      }
      break;
    }
  }
}

async function orgByCustomer(customerId: string): Promise<string | null> {
  const rows = await q("select id from orgs where stripe_customer_id=$1", [customerId]);
  return rows[0]?.id || null;
}

/* ============================ PLAN GATING ============================ */

export interface OrgState {
  id: string;
  name: string;
  plan: PlanId;
  planStatus: string;
  trialEndsAt: string | null;
  truckLimit: number;
}

export async function getOrgState(orgId: string): Promise<OrgState | null> {
  const rows = await q(
    `select id, name, plan, plan_status,
            to_char(trial_ends_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') as trial_ends_at, truck_limit
     from orgs where id=$1`,
    [orgId],
  );
  if (!rows.length) return null;
  const o = rows[0];
  return {
    id: o.id, name: o.name, plan: o.plan, planStatus: o.plan_status,
    trialEndsAt: o.trial_ends_at, truckLimit: o.truck_limit,
  };
}

// Distinct trucks (units) currently used by an org's active loads.
export async function truckCount(orgId: string): Promise<number> {
  const rows = await q(
    "select count(distinct unit)::int as n from loads where org_id=$1 and unit is not null and unit<>''",
    [orgId],
  );
  return rows[0]?.n || 0;
}

// Is the org allowed to add another truck (unit)? -1 limit = unlimited.
export async function withinTruckLimit(orgId: string, addingUnit?: string | null): Promise<boolean> {
  const state = await getOrgState(orgId);
  if (!state || state.truckLimit < 0) return true;
  // If the unit already exists for this org, it isn't a new truck.
  if (addingUnit) {
    const existing = await q(
      "select 1 from loads where org_id=$1 and unit=$2 limit 1",
      [orgId, addingUnit],
    );
    if (existing.length) return true;
  }
  const used = await truckCount(orgId);
  return used < state.truckLimit;
}

// Is the org's subscription in a usable state (trialing-and-not-expired, or active)?
export function accessState(state: OrgState): { ok: boolean; reason?: string } {
  if (state.planStatus === "active") return { ok: true };
  if (state.plan === "trial" && state.planStatus === "trialing") {
    if (state.trialEndsAt && new Date(state.trialEndsAt).getTime() < Date.now()) {
      return { ok: false, reason: "trial_expired" };
    }
    return { ok: true };
  }
  if (state.planStatus === "past_due") return { ok: true }; // grace — don't lock out on a failed charge immediately
  return { ok: false, reason: state.planStatus };
}
