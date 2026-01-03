import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeClient, getStripeConfigForMode } from "@/lib/billing/stripe";
import { constructStripeEvent, requireCheckoutMetadata, resolvePlanFromStripe } from "@/lib/billing/stripe-webhook";
import { computeStripePlanUpdate } from "@/lib/billing/stripe-plan-update";
import { parseWebhookInsertError, shouldMarkWebhookProcessed } from "@/lib/billing/stripe-webhook-events";
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
  event: Stripe.Event
) {
  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => Promise<{ error: { code?: string } | null }>;
    };
  };
  const { error } = await adminDb
    .from("stripe_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
      status: "received",
      mode: event.livemode ? "live" : "test",
    });
  return parseWebhookInsertError(error as { code?: string } | null);
}

async function updateStripeWebhookEvent(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  eventId: string,
  updates: Record<string, unknown>
) {
  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
      };
    };
  };
  const { error } = await adminDb
    .from("stripe_webhook_events")
    .update(updates)
    .eq("event_id", eventId);
  return { error };
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
  const decision = computeStripePlanUpdate(
    {
      tier: input.tier,
      status: input.status,
      currentPeriodEnd: input.currentPeriodEnd,
      allowImmediateDowngrade: input.allowImmediateDowngrade,
    },
    existingPlan
  );

  if (decision.skipped) {
    return {
      error: null,
      planTier: decision.planTier,
      validUntil: decision.validUntil,
      skipped: true,
      skipReason: decision.skipReason,
      applied: false,
    };
  }

  const now = new Date().toISOString();
  const planTier = decision.planTier;
  const validUntil = decision.validUntil;

  if (isRedundantStripeUpdate(existingPlan, input, planTier, validUntil)) {
    return {
      error: null,
      planTier,
      validUntil,
      skipped: true,
      skipReason: "duplicate_update",
      applied: false,
    };
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

  return {
    error,
    planTier,
    validUntil,
    skipped: false,
    skipReason: null,
    applied: !error,
  };
}

export async function POST(request: Request) {
  const startTime = Date.now();

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Supabase service role missing" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  let event: Stripe.Event;

  const { stripeMode } = await getProviderModes();
  const stripeConfig = getStripeConfigForMode(stripeMode);
  if (!stripeConfig.secretKey || !stripeConfig.webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  try {
    event = constructStripeEvent(payload, signature, {
      secretKey: stripeConfig.secretKey,
      webhookSecret: stripeConfig.webhookSecret,
    });
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
  const idempotency = await recordStripeWebhookEvent(adminClient, event);
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
    console.log(
      JSON.stringify({
        level: "info",
        event: "stripe_webhook_duplicate",
        route: routeLabel,
        eventType: event.type,
        eventId: event.id,
      })
    );
    return NextResponse.json({ received: true });
  }

  const stripe = getStripeClient(stripeConfig.secretKey);
  let outcomeStatus: "processed" | "ignored" | "failed" | "error" = "processed";
  let outcomeReason: string | null = null;
  let outcomeProfileId: string | null = null;
  let outcomePlanTier: string | null = null;
  let outcomeCustomerId: string | null = null;
  let outcomeSubscriptionId: string | null = null;
  let outcomePriceId: string | null = null;
  let planApplied = false;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) {
          outcomeStatus = "ignored";
          outcomeReason = "missing_subscription";
          break;
        }
        const metadataCheck = requireCheckoutMetadata(session.metadata || null);
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string, {
          expand: ["items.data.price"],
        });
        const plan = resolvePlanFromStripe(subscription, session.metadata || undefined);
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        outcomeCustomerId = customerId;
        outcomeSubscriptionId = subscription.id;
        outcomePriceId = plan.priceId;

        if (!metadataCheck.ok) {
          outcomeStatus = "error";
          outcomeReason = "missing_metadata";
          outcomeProfileId = metadataCheck.profileId;
          outcomePlanTier = metadataCheck.tier ?? plan.tier;
          break;
        }
        if (!plan.tier) {
          logFailure({
            request,
            route: routeLabel,
            status: 200,
            startTime,
            level: "warn",
            error: new Error(`stripe_plan_mapping_missing price_id=${plan.priceId || "unknown"}`),
          });
          outcomeStatus = "ignored";
          outcomeReason = "missing_plan_mapping";
          break;
        }
        const profileId =
          metadataCheck.profileId ||
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
          outcomeStatus = "ignored";
          outcomeReason = "missing_profile_id";
          break;
        }
        outcomeProfileId = profileId;
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

        if (result.error) {
          outcomeStatus = "failed";
          outcomeReason = "plan_update_failed";
          logFailure({
            request,
            route: routeLabel,
            status: 500,
            startTime,
            error: result.error,
          });
          break;
        }

        if (result.skipped) {
          outcomeStatus = "ignored";
          outcomeReason = result.skipReason;
        }
        outcomePlanTier = result.planTier;
        planApplied = result.applied;

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
          outcomeStatus = "ignored";
          outcomeReason = "missing_plan_mapping";
          break;
        }
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        outcomeCustomerId = customerId;
        outcomeSubscriptionId = subscription.id;
        outcomePriceId = plan.priceId;
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
          outcomeStatus = "ignored";
          outcomeReason = "missing_profile_id";
          break;
        }
        outcomeProfileId = profileId;
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

        if (result.error) {
          outcomeStatus = "failed";
          outcomeReason = "plan_update_failed";
          logFailure({
            request,
            route: routeLabel,
            status: 500,
            startTime,
            error: result.error,
          });
          break;
        }

        if (result.skipped) {
          outcomeStatus = "ignored";
          outcomeReason = result.skipReason;
        }
        outcomePlanTier = result.planTier;
        planApplied = result.applied;

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
          outcomeStatus = "ignored";
          outcomeReason = "missing_plan_mapping";
          break;
        }
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        outcomeCustomerId = customerId;
        outcomeSubscriptionId = subscription.id;
        outcomePriceId = plan.priceId;
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
          outcomeStatus = "ignored";
          outcomeReason = "missing_profile_id";
          break;
        }
        outcomeProfileId = profileId;
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

        if (result.error) {
          outcomeStatus = "failed";
          outcomeReason = "plan_update_failed";
          logFailure({
            request,
            route: routeLabel,
            status: 500,
            startTime,
            error: result.error,
          });
          break;
        }

        if (result.skipped) {
          outcomeStatus = "ignored";
          outcomeReason = result.skipReason;
        }
        outcomePlanTier = result.planTier;
        planApplied = result.applied;

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
        outcomeStatus = "ignored";
        outcomeReason = "unhandled_event";
        break;
    }

    const shouldStamp = shouldMarkWebhookProcessed({
      applied: planApplied,
      status: outcomeStatus,
      reason: outcomeReason,
    });

    await updateStripeWebhookEvent(adminClient, event.id, {
      status: outcomeStatus,
      reason: outcomeReason,
      processed_at: shouldStamp ? new Date().toISOString() : null,
      profile_id: outcomeProfileId,
      plan_tier: outcomePlanTier,
      stripe_customer_id: outcomeCustomerId,
      stripe_subscription_id: outcomeSubscriptionId,
      stripe_price_id: outcomePriceId,
    });

    logStripeWebhookApplied({
      route: routeLabel,
      eventType: event.type,
      eventId: event.id,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    await updateStripeWebhookEvent(adminClient, event.id, {
      status: "failed",
      reason: "handler_error",
      processed_at: null,
    });
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
