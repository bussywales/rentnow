import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { getProviderModes } from "@/lib/billing/provider-settings";
import type { BillingRole } from "@/lib/billing/stripe-plans";
import { getStripeClient, getStripeConfigForMode } from "@/lib/billing/stripe";
import { getSiteUrl } from "@/lib/env";
import { logFailure, logStripeCheckoutStarted } from "@/lib/observability";
import { sanitizeUserFacingErrorMessage } from "@/lib/observability/user-facing-errors";
import { captureServerException } from "@/lib/monitoring/sentry";
import { getMarketSettings } from "@/lib/market/market.server";
import { resolveMarketFromRequest } from "@/lib/market/market";
import { resolveSubscriptionPlanQuote } from "@/lib/billing/subscription-pricing";
import { loadSubscriptionPriceBookRows } from "@/lib/billing/subscription-price-book.repository";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";

const routeLabel = "/api/billing/stripe/checkout";
const CHECKOUT_START_ERROR = "We couldn’t start checkout right now. Try again in a moment.";

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

type RequireRoleResult = Awaited<ReturnType<typeof requireRole>>;

export type StripeCheckoutRouteDeps = {
  requireRole: typeof requireRole;
  getProviderModes: typeof getProviderModes;
  getStripeConfigForMode: typeof getStripeConfigForMode;
  getMarketSettings: typeof getMarketSettings;
  resolveMarketFromRequest: typeof resolveMarketFromRequest;
  loadSubscriptionPriceBookRows: typeof loadSubscriptionPriceBookRows;
  resolveSubscriptionPlanQuote: typeof resolveSubscriptionPlanQuote;
  getSiteUrl: typeof getSiteUrl;
  getStripeClient: typeof getStripeClient;
  logFailure: typeof logFailure;
  logStripeCheckoutStarted: typeof logStripeCheckoutStarted;
  logProductAnalyticsEvent: typeof logProductAnalyticsEvent;
};

const defaultDeps: StripeCheckoutRouteDeps = {
  requireRole,
  getProviderModes,
  getStripeConfigForMode,
  getMarketSettings,
  resolveMarketFromRequest,
  loadSubscriptionPriceBookRows,
  resolveSubscriptionPlanQuote,
  getSiteUrl,
  getStripeClient,
  logFailure,
  logStripeCheckoutStarted,
  logProductAnalyticsEvent,
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

async function resolveAuth(
  request: Request,
  startTime: number,
  deps: StripeCheckoutRouteDeps
): Promise<RequireRoleResult> {
  return deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "tenant"],
  });
}

export async function postStripeCheckoutResponse(
  request: Request,
  deps: StripeCheckoutRouteDeps = defaultDeps
) {
  const startTime = Date.now();

  try {
    const auth = await resolveAuth(request, startTime, deps);
    if (!auth.ok) return auth.response;

    const payload = bodySchema.parse(await request.json());
    if (auth.role === "tenant" && payload.tier !== "tenant_pro") {
      return NextResponse.json({ error: "Invalid plan selection" }, { status: 400 });
    }
    if (auth.role !== "tenant" && payload.tier === "tenant_pro") {
      return NextResponse.json({ error: "Invalid plan selection" }, { status: 400 });
    }

    const billingRole = auth.role as BillingRole;
    const { stripeMode } = await deps.getProviderModes();
    const stripeConfig = deps.getStripeConfigForMode(stripeMode);
    if (!stripeConfig.secretKey) {
      return NextResponse.json(
        { error: "Stripe is not configured", code: "stripe_not_configured" },
        { status: 503 }
      );
    }

    const market = deps.resolveMarketFromRequest({
      headers: request.headers,
      appSettings: await deps.getMarketSettings(),
    });
    const canonicalRows = await deps.loadSubscriptionPriceBookRows();
    const resolvedQuote = await deps.resolveSubscriptionPlanQuote({
      role: billingRole,
      tier: payload.tier,
      cadence: payload.cadence,
      market,
      canonicalRows,
      stripe: {
        enabled: true,
        mode: stripeConfig.mode,
        secretKey: stripeConfig.secretKey,
      },
      paystack: {
        enabled: false,
        mode: "test",
      },
      flutterwave: {
        enabled: false,
        mode: "test",
      },
    });
    if (
      resolvedQuote.status !== "ready" ||
      resolvedQuote.provider !== "stripe" ||
      !resolvedQuote.priceId
    ) {
      return NextResponse.json(
        {
          error: resolvedQuote.unavailableReason || "Stripe price not configured",
          code: "stripe_price_missing",
        },
        { status: 503 }
      );
    }

    const { data: planRow, error } = await auth.supabase
      .from("profile_plans")
      .select("stripe_customer_id, stripe_subscription_id, stripe_status, stripe_current_period_end")
      .eq("profile_id", auth.user.id)
      .maybeSingle();

    if (error) {
      deps.logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        error,
      });
      captureServerException(error, {
        route: routeLabel,
        request,
        status: 500,
        userId: auth.user.id,
        userRole: auth.role,
        tags: {
          flow: "stripe_checkout",
          stage: "profile_plan_lookup",
        },
      });
      return NextResponse.json({ error: CHECKOUT_START_ERROR }, { status: 500 });
    }

    if (isActiveStripeSubscription(planRow || null)) {
      return NextResponse.json(
        { error: "Active subscription already exists", code: "subscription_active" },
        { status: 409 }
      );
    }

    const siteUrl = await deps.getSiteUrl();
    if (!siteUrl) {
      return NextResponse.json({ error: CHECKOUT_START_ERROR }, { status: 500 });
    }

    const stripe = deps.getStripeClient(stripeConfig.secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: planRow?.stripe_customer_id || undefined,
      customer_email: auth.user.email || undefined,
      client_reference_id: auth.user.id,
      line_items: [{ price: resolvedQuote.priceId, quantity: 1 }],
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
        subscription_market_country: market.country,
        subscription_market_currency: market.currency,
        subscription_resolved_currency: resolvedQuote.currency,
        subscription_price_key: resolvedQuote.resolutionKey,
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
          subscription_market_country: market.country,
          subscription_market_currency: market.currency,
          subscription_resolved_currency: resolvedQuote.currency,
          subscription_price_key: resolvedQuote.resolutionKey,
          env: process.env.NODE_ENV || "unknown",
        },
      },
    });

    deps.logStripeCheckoutStarted({
      request,
      route: routeLabel,
      actorId: auth.user.id,
      role: auth.role,
      tier: payload.tier,
      cadence: payload.cadence,
    });

    await deps.logProductAnalyticsEvent({
      eventName: "checkout_started",
      request,
      supabase: auth.supabase,
      userId: auth.user.id,
      userRole: auth.role,
      properties: {
        market: market.country,
        role: auth.role,
        planTier: payload.tier,
        cadence: payload.cadence,
        billingSource: "stripe",
        currency: resolvedQuote.currency ?? undefined,
        amount:
          typeof resolvedQuote.amountMinor === "number"
            ? resolvedQuote.amountMinor / 100
            : undefined,
        provider: "stripe",
      },
    });

    if (!session.url) {
      captureServerException(new Error("stripe_checkout_url_missing"), {
        route: routeLabel,
        request,
        status: 502,
        userId: auth.user.id,
        userRole: auth.role,
        tags: {
          flow: "stripe_checkout",
          stage: "session_url_missing",
        },
        extra: {
          tier: payload.tier,
          cadence: payload.cadence,
          market: market.country,
        },
      });
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    captureServerException(error, {
      route: routeLabel,
      request,
      status: 500,
      tags: {
        flow: "stripe_checkout",
        stage: "unhandled_exception",
      },
    });
    return NextResponse.json(
      {
        error: sanitizeUserFacingErrorMessage(
          error instanceof Error ? error.message : null,
          CHECKOUT_START_ERROR
        ),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return postStripeCheckoutResponse(request, defaultDeps);
}
