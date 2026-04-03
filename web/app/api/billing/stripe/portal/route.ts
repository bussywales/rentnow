import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeClient, getStripeConfigForMode } from "@/lib/billing/stripe";
import {
  buildStripeCustomerPortalReturnPath,
  evaluateStripeCustomerPortalAccess,
} from "@/lib/billing/stripe-customer-portal";
import { getSiteUrl } from "@/lib/env";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/billing/stripe/portal";

type PlanRow = {
  billing_source?: string | null;
  plan_tier?: string | null;
  valid_until?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_status?: string | null;
  stripe_current_period_end?: string | null;
};

type SubscriptionRow = {
  provider?: string | null;
  provider_subscription_id?: string | null;
  status?: string | null;
  current_period_end?: string | null;
  canceled_at?: string | null;
};

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "tenant"],
  });
  if (!auth.ok) return auth.response;

  const { data: planRow, error } = await auth.supabase
    .from("profile_plans")
    .select(
      "billing_source, plan_tier, valid_until, stripe_customer_id, stripe_subscription_id, stripe_status, stripe_current_period_end"
    )
    .eq("profile_id", auth.user.id)
    .maybeSingle();

  if (error) {
    logFailure({ request, route: routeLabel, status: 500, startTime, error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: subscriptionRow } = await auth.supabase
    .from("subscriptions")
    .select("provider, provider_subscription_id, status, current_period_end, canceled_at")
    .eq("user_id", auth.user.id)
    .eq("provider", "stripe")
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const portalAccess = evaluateStripeCustomerPortalAccess({
    plan: (planRow as PlanRow | null) ?? null,
    providerSubscription: (subscriptionRow as SubscriptionRow | null) ?? null,
  });
  if (!portalAccess.ok) {
    return NextResponse.json({ error: portalAccess.reason, code: "portal_unavailable" }, { status: 409 });
  }

  const { stripeMode } = await getProviderModes();
  const stripeConfig = getStripeConfigForMode(stripeMode);
  if (!stripeConfig.secretKey) {
    return NextResponse.json(
      { error: "Stripe is not configured", code: "stripe_not_configured" },
      { status: 503 }
    );
  }
  const stripe = getStripeClient(stripeConfig.secretKey);
  const siteUrl = await getSiteUrl();
  if (!siteUrl) {
    return NextResponse.json({ error: "Unable to resolve site URL" }, { status: 500 });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: portalAccess.customerId,
      return_url: `${siteUrl}${buildStripeCustomerPortalReturnPath(auth.role)}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 502,
      startTime,
      error,
    });
    return NextResponse.json(
      {
        error: "Unable to open Stripe billing portal right now.",
        code: "portal_session_failed",
      },
      { status: 502 }
    );
  }
}
