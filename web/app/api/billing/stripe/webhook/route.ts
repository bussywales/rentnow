import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/billing/stripe";
import { constructStripeEvent, resolvePlanFromStripe } from "@/lib/billing/stripe-webhook";
import { logFailure, logStripePaymentFailed, logStripePlanUpdated, logStripeWebhookApplied } from "@/lib/observability";

const routeLabel = "/api/billing/stripe/webhook";

type PlanUpdateInput = {
  profileId: string;
  tier: string;
  status: string | null;
  customerId: string | null;
  subscriptionId: string;
  priceId: string | null;
  currentPeriodEnd: string | null;
  allowImmediateDowngrade?: boolean;
};

type ExistingPlan = {
  billing_source?: string | null;
  plan_tier?: string | null;
  valid_until?: string | null;
  stripe_subscription_id?: string | null;
  stripe_status?: string | null;
  stripe_price_id?: string | null;
  stripe_current_period_end?: string | null;
};

function toIso(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

async function lookupProfileIdByCustomer(adminClient: ReturnType<typeof createServiceRoleClient>, customerId: string) {
  const { data } = await adminClient
    .from("profile_plans")
    .select("profile_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  const row = data as { profile_id?: string } | null;
  return row?.profile_id || null;
}

async function lookupProfileIdBySubscription(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  subscriptionId: string
) {
  const { data } = await adminClient
    .from("profile_plans")
    .select("profile_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  const row = data as { profile_id?: string } | null;
  return row?.profile_id || null;
}

async function recordStripeWebhookEvent(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  eventId: string,
  eventType: string
) {
  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => Promise<{ error: { code?: string } | null }>;
    };
  };
  const { error } = await adminDb
    .from("stripe_webhook_events")
    .insert({ event_id: eventId, event_type: eventType });
  if (!error) return { duplicate: false, error: null };
  const code = (error as { code?: string }).code;
  if (code === "23505") return { duplicate: true, error: null };
  return { duplicate: false, error };
}

async function getExistingPlan(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  profileId: string
): Promise<ExistingPlan | null> {
  const { data } = await adminClient
    .from("profile_plans")
    .select(
      "billing_source, plan_tier, valid_until, stripe_subscription_id, stripe_status, stripe_price_id, stripe_current_period_end"
    )
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data as ExistingPlan | null) ?? null;
}

function isManualOverride(plan: ExistingPlan | null) {
  return plan?.billing_source === "manual";
}

function isRedundantStripeUpdate(plan: ExistingPlan | null, input: PlanUpdateInput, planTier: string, validUntil: string | null) {
  if (!plan) return false;
  return (
    plan.billing_source === "stripe" &&
    plan.stripe_subscription_id === input.subscriptionId &&
    plan.stripe_status === input.status &&
    plan.stripe_price_id === input.priceId &&
    plan.stripe_current_period_end === input.currentPeriodEnd &&
    plan.plan_tier === planTier &&
    plan.valid_until === validUntil
  );
}

async function applyPlanUpdate(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  input: PlanUpdateInput,
  existingPlan: ExistingPlan | null
) {
  if (isManualOverride(existingPlan)) {
    return { error: null, planTier: existingPlan?.plan_tier ?? "free", validUntil: existingPlan?.valid_until ?? null, skipped: true };
  }

  const now = new Date().toISOString();
  const isExpired =
    !!input.currentPeriodEnd &&
    Number.isFinite(Date.parse(input.currentPeriodEnd)) &&
    Date.parse(input.currentPeriodEnd) <= Date.now();
  const shouldDowngradeNow =
    !!input.allowImmediateDowngrade ||
    input.status === "canceled" ||
    input.status === "incomplete_expired" ||
    isExpired;
  const planTier = shouldDowngradeNow ? "free" : input.tier;
  const validUntil = shouldDowngradeNow ? null : input.currentPeriodEnd;

  if (isRedundantStripeUpdate(existingPlan, input, planTier, validUntil)) {
    return { error: null, planTier, validUntil, skipped: true };
  }

  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      upsert: (
        values: Record<string, unknown>,
        options?: { onConflict?: string }
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await adminDb
    .from("profile_plans")
    .upsert(
      {
        profile_id: input.profileId,
        plan_tier: planTier,
        billing_source: "stripe",
        valid_until: validUntil,
        stripe_customer_id: input.customerId,
        stripe_subscription_id: input.subscriptionId,
        stripe_price_id: input.priceId,
        stripe_current_period_end: input.currentPeriodEnd,
        stripe_status: input.status,
        updated_at: now,
        updated_by: null,
      },
      { onConflict: "profile_id" }
    );

  return { error, planTier, validUntil, skipped: false };
}

export async function POST(request: Request) {
  const startTime = Date.now();

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Supabase service role missing" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = constructStripeEvent(payload, signature);
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const adminClient = createServiceRoleClient();
  const idempotency = await recordStripeWebhookEvent(adminClient, event.id, event.type);
  if (idempotency.error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: idempotency.error,
    });
    return NextResponse.json({ error: "Webhook idempotency failed" }, { status: 500 });
  }
  if (idempotency.duplicate) {
    logStripeWebhookApplied({
      route: routeLabel,
      eventType: event.type,
      eventId: event.id,
    });
    return NextResponse.json({ received: true });
  }

  const stripe = getStripeClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string, {
          expand: ["items.data.price"],
        });
        const plan = resolvePlanFromStripe(subscription, session.metadata || undefined);
        if (!plan.tier) {
          logFailure({
            request,
            route: routeLabel,
            status: 200,
            startTime,
            level: "warn",
            error: new Error(`stripe_plan_mapping_missing price_id=${plan.priceId || "unknown"}`),
          });
          break;
        }
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        const profileId =
          plan.profileId ||
          (customerId ? await lookupProfileIdByCustomer(adminClient, customerId) : null) ||
          (subscription.id ? await lookupProfileIdBySubscription(adminClient, subscription.id) : null);

        if (!profileId) {
          logFailure({
            request,
            route: routeLabel,
            status: 200,
            startTime,
            error: "stripe_missing_profile_id",
          });
          break;
        }
        const currentPeriodEnd = toIso(subscription.current_period_end);
        const tier = plan.tier;
        const existingPlan = await getExistingPlan(adminClient, profileId);
        const result = await applyPlanUpdate(
          adminClient,
          {
          profileId,
          tier,
          status: subscription.status,
          customerId,
          subscriptionId: subscription.id,
          priceId: plan.priceId,
          currentPeriodEnd,
          },
          existingPlan
        );

        if (!result.skipped) {
          logStripePlanUpdated({
            route: routeLabel,
            profileId,
            planTier: result.planTier,
            stripeStatus: subscription.status,
            stripeSubscriptionId: subscription.id,
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const plan = resolvePlanFromStripe(subscription, undefined);
        if (!plan.tier) {
          logFailure({
            request,
            route: routeLabel,
            status: 200,
            startTime,
            level: "warn",
            error: new Error(`stripe_plan_mapping_missing price_id=${plan.priceId || "unknown"}`),
          });
          break;
        }
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        const profileId =
          plan.profileId ||
          (customerId ? await lookupProfileIdByCustomer(adminClient, customerId) : null) ||
          (subscription.id ? await lookupProfileIdBySubscription(adminClient, subscription.id) : null);

        if (!profileId) {
          logFailure({
            request,
            route: routeLabel,
            status: 200,
            startTime,
            error: "stripe_missing_profile_id",
          });
          break;
        }
        const currentPeriodEnd = toIso(subscription.current_period_end);
        const tier = plan.tier;
        const allowImmediateDowngrade = event.type === "customer.subscription.deleted";
        const existingPlan = await getExistingPlan(adminClient, profileId);
        const result = await applyPlanUpdate(
          adminClient,
          {
          profileId,
          tier,
          status: subscription.status,
          customerId,
          subscriptionId: subscription.id,
          priceId: plan.priceId,
          currentPeriodEnd,
          allowImmediateDowngrade,
          },
          existingPlan
        );

        if (!result.skipped) {
          logStripePlanUpdated({
            route: routeLabel,
            profileId,
            planTier: result.planTier,
            stripeStatus: subscription.status,
            stripeSubscriptionId: subscription.id,
          });
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price"],
        });
        const plan = resolvePlanFromStripe(subscription, invoice.metadata || undefined);
        if (!plan.tier) {
          logFailure({
            request,
            route: routeLabel,
            status: 200,
            startTime,
            level: "warn",
            error: new Error(`stripe_plan_mapping_missing price_id=${plan.priceId || "unknown"}`),
          });
          break;
        }
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        const profileId =
          plan.profileId ||
          (customerId ? await lookupProfileIdByCustomer(adminClient, customerId) : null) ||
          (subscription.id ? await lookupProfileIdBySubscription(adminClient, subscription.id) : null);

        if (!profileId) {
          logFailure({
            request,
            route: routeLabel,
            status: 200,
            startTime,
            error: "stripe_missing_profile_id",
          });
          break;
        }
        const currentPeriodEnd = toIso(subscription.current_period_end);
        const tier = plan.tier;
        const existingPlan = await getExistingPlan(adminClient, profileId);
        const result = await applyPlanUpdate(
          adminClient,
          {
          profileId,
          tier,
          status: subscription.status,
          customerId,
          subscriptionId: subscription.id,
          priceId: plan.priceId,
          currentPeriodEnd,
          },
          existingPlan
        );

        if (!result.skipped) {
          logStripePlanUpdated({
            route: routeLabel,
            profileId,
            planTier: result.planTier,
            stripeStatus: subscription.status,
            stripeSubscriptionId: subscription.id,
          });
        }

        if (!result.skipped && event.type === "invoice.payment_failed") {
          logStripePaymentFailed({
            route: routeLabel,
            profileId,
            stripeSubscriptionId: subscription.id,
            stripeStatus: subscription.status,
          });
        }
        break;
      }
      default:
        break;
    }

    logStripeWebhookApplied({
      route: routeLabel,
      eventType: event.type,
      eventId: event.id,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
