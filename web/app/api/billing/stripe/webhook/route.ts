import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeClient, getStripeConfigForMode } from "@/lib/billing/stripe";
import { constructStripeEvent } from "@/lib/billing/stripe-webhook";
import { parseWebhookInsertError, shouldMarkWebhookProcessed } from "@/lib/billing/stripe-webhook-events";
import { processStripeEvent } from "@/lib/billing/stripe-event-processor";
import { logFailure, logStripeWebhookApplied } from "@/lib/observability";

const routeLabel = "/api/billing/stripe/webhook";

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

  try {
    const outcome = await processStripeEvent(
      {
        adminClient,
        stripe,
        route: routeLabel,
        startTime,
        request,
      },
      event
    );

    const shouldStamp = shouldMarkWebhookProcessed({
      applied: outcome.applied,
      status: outcome.status,
      reason: outcome.reason,
    });

    await updateStripeWebhookEvent(adminClient, event.id, {
      status: outcome.status,
      reason: outcome.reason,
      processed_at: shouldStamp ? new Date().toISOString() : null,
      mode: event.livemode ? "live" : "test",
      profile_id: outcome.profileId,
      plan_tier: outcome.planTier,
      stripe_customer_id: outcome.customerId,
      stripe_subscription_id: outcome.subscriptionId,
      stripe_price_id: outcome.priceId,
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
