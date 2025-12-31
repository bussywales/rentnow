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

async function applyPlanUpdate(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  input: PlanUpdateInput
) {
  const now = new Date().toISOString();
  const expired = input.currentPeriodEnd
    ? Date.parse(input.currentPeriodEnd) <= Date.now()
    : false;
  const planTier = input.allowImmediateDowngrade && expired ? "free" : input.tier;
  const validUntil = input.allowImmediateDowngrade && expired ? null : input.currentPeriodEnd;
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

  return { error, planTier, validUntil };
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
        const tier = plan.tier || "starter";
        const result = await applyPlanUpdate(adminClient, {
          profileId,
          tier,
          status: subscription.status,
          customerId,
          subscriptionId: subscription.id,
          priceId: plan.priceId,
          currentPeriodEnd,
        });

        logStripePlanUpdated({
          route: routeLabel,
          profileId,
          planTier: result.planTier,
          stripeStatus: subscription.status,
          stripeSubscriptionId: subscription.id,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const plan = resolvePlanFromStripe(subscription, undefined);
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
        const tier = plan.tier || "starter";
        const allowImmediateDowngrade = event.type === "customer.subscription.deleted";
        const result = await applyPlanUpdate(adminClient, {
          profileId,
          tier,
          status: subscription.status,
          customerId,
          subscriptionId: subscription.id,
          priceId: plan.priceId,
          currentPeriodEnd,
          allowImmediateDowngrade,
        });

        logStripePlanUpdated({
          route: routeLabel,
          profileId,
          planTier: result.planTier,
          stripeStatus: subscription.status,
          stripeSubscriptionId: subscription.id,
        });
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
        const tier = plan.tier || "starter";
        const result = await applyPlanUpdate(adminClient, {
          profileId,
          tier,
          status: subscription.status,
          customerId,
          subscriptionId: subscription.id,
          priceId: plan.priceId,
          currentPeriodEnd,
        });

        logStripePlanUpdated({
          route: routeLabel,
          profileId,
          planTier: result.planTier,
          stripeStatus: subscription.status,
          stripeSubscriptionId: subscription.id,
        });

        if (event.type === "invoice.payment_failed") {
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
