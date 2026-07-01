// Subscription plans + tenancy constants.
//
// Pricing is deliberately flat, transparent, and contract-free — the opposite of
// the incumbents small carriers complain about (McLeod/TMW six-figure implementations,
// opaque "call for a quote" pricing, multi-year contracts, per-seat upcharges).
// Every plan includes the AI rate-con auto-import that kills the #1 complaint about
// legacy TMS: re-keying every rate confirmation by hand.

export type PlanId = "trial" | "starter" | "growth" | "fleet";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;        // USD/month, flat — no per-seat fees
  truckLimit: number;          // -1 = unlimited
  blurb: string;
  features: string[];
  stripePriceEnv: string;      // env var holding the Stripe Price ID
}

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "Free Trial",
    priceMonthly: 0,
    truckLimit: 5,
    blurb: "14 days, full Growth features, no card required.",
    features: [
      "Up to 5 trucks",
      "AI rate-con auto-import",
      "Dispatch board + P&L",
      "No credit card to start",
    ],
    stripePriceEnv: "",
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 79,
    truckLimit: 5,
    blurb: "For owner-operators and 1–5 truck carriers.",
    features: [
      "Up to 5 trucks",
      "AI rate-con auto-import (no double entry)",
      "Kanban dispatch board",
      "Weekly + monthly P&L by truck",
      "CSV / QuickBooks export",
      "Email + chat support",
    ],
    stripePriceEnv: "STRIPE_PRICE_STARTER",
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceMonthly: 149,
    truckLimit: 15,
    blurb: "For growing fleets that want the AI agents.",
    features: [
      "Up to 15 trucks",
      "Everything in Starter",
      "AI Operations Analyst + Workflow Executor",
      "Dispatch copilot",
      "Gmail integration (draft in your voice)",
      "Priority support",
    ],
    stripePriceEnv: "STRIPE_PRICE_GROWTH",
  },
  fleet: {
    id: "fleet",
    name: "Fleet",
    priceMonthly: 299,
    truckLimit: -1,
    blurb: "Unlimited trucks for established carriers.",
    features: [
      "Unlimited trucks",
      "Everything in Growth",
      "Driver recruiting pipeline + AI recruiter",
      "Social content generator",
      "Dedicated onboarding",
      "Phone support",
    ],
    stripePriceEnv: "STRIPE_PRICE_FLEET",
  },
};

export function planById(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId)] || PLANS.trial;
}

export function truckLimitFor(planId: string | null | undefined): number {
  return planById(planId).truckLimit;
}

// 14-day free trial.
export const TRIAL_DAYS = 14;

// Fixed id for Joe's original org so seed + the legacy shared-password login
// can reference it deterministically.
export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
