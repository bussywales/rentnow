import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeClient, getStripeConfigForMode } from "@/lib/billing/stripe";
import { getStripePriceId } from "@/lib/billing/stripe-plans";
import { getSiteUrl } from "@/lib/env";
import { logFailure, logStripeCheckoutStarted } from "@/lib/observability";

const routeLabel = "/api/billing/stripe/checkout";

const bodySchema = z.object({
  tier: z.enum(["starter", "pro", "tenant_pro"]),
  cadence: z.enum(["monthly", "yearly"]),
});

type PlanRow = {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_status?: string | null;
  stripe_current_period_end?: string | null;
};

function isActiveStripeSubscription(plan: PlanRow | null) {
  if (!plan?.stripe_subscription_id) return false;
  const status = plan.stripe_status || "";
  const activeStatuses = new Set(["active", "trialing", "past_due", "unpaid"]);
  const periodEnd = plan.stripe_current_period_end
    ? Date.parse(plan.stripe_current_period_end)
    : NaN;
  if (!Number.isNaN(periodEnd)) {
    return periodEnd > Date.now() && activeStatuses.has(status || "active");
  }
  return activeStatuses.has(status);
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "tenant"],
  });
  if (!auth.ok) return auth.response;

  const payload = bodySchema.parse(await request.json());
  if (auth.role === "tenant" && payload.tier !== "tenant_pro") {
    return NextResponse.json({ error: "Invalid plan selection" }, { status: 400 });
  }
  if (auth.role !== "tenant" && payload.tier === "tenant_pro") {
    return NextResponse.json({ error: "Invalid plan selection" }, { status: 400 });
  }
  const { stripeMode } = await getProviderModes();
  const stripeConfig = getStripeConfigForMode(stripeMode);
  if (!stripeConfig.secretKey) {
    return NextResponse.json(
      { error: "Stripe is not configured", code: "stripe_not_configured" },
      { status: 503 }
    );
  }
  const priceId = getStripePriceId({
    role: auth.role,
    tier: payload.tier,
    cadence: payload.cadence,
    mode: stripeConfig.mode,
  });

  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price not configured", code: "stripe_price_missing" },
      { status: 503 }
    );
  }

  const { data: planRow, error } = await auth.supabase
    .from("profile_plans")
    .select("stripe_customer_id, stripe_subscription_id, stripe_status, stripe_current_period_end")
    .eq("profile_id", auth.user.id)
    .maybeSingle();

  if (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (isActiveStripeSubscription(planRow || null)) {
    return NextResponse.json(
      { error: "Active subscription already exists", code: "subscription_active" },
      { status: 409 }
    );
  }

  const siteUrl = await getSiteUrl();
  if (!siteUrl) {
    return NextResponse.json(
      { error: "Unable to resolve site URL" },
      { status: 500 }
    );
  }

  const stripe = getStripeClient(stripeConfig.secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: planRow?.stripe_customer_id || undefined,
    customer_email: auth.user.email || undefined,
    client_reference_id: auth.user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${siteUrl}/dashboard?stripe=success`,
    cancel_url: `${siteUrl}/dashboard?stripe=cancel`,
    metadata: {
      profile_id: auth.user.id,
      user_id: auth.user.id,
      role: auth.role,
      plan_tier: payload.tier,
      tier: payload.tier,
      cadence: payload.cadence,
      billing_source: "stripe",
      stripe_mode: stripeConfig.mode,
      env: process.env.NODE_ENV || "unknown",
    },
    subscription_data: {
      metadata: {
        profile_id: auth.user.id,
        user_id: auth.user.id,
        role: auth.role,
        plan_tier: payload.tier,
        tier: payload.tier,
        cadence: payload.cadence,
        billing_source: "stripe",
        stripe_mode: stripeConfig.mode,
        env: process.env.NODE_ENV || "unknown",
      },
    },
  });

  logStripeCheckoutStarted({
    request,
    route: routeLabel,
    actorId: auth.user.id,
    role: auth.role,
    tier: payload.tier,
    cadence: payload.cadence,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
