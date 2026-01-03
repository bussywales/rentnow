import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeClient, getStripeConfigForMode } from "@/lib/billing/stripe";
import { processStripeEvent } from "@/lib/billing/stripe-event-processor";
import { shouldMarkWebhookProcessed } from "@/lib/billing/stripe-webhook-events";
import { isReplayAlreadyProcessed, resolveReplayMode } from "@/lib/billing/stripe-replay";
import { logStripeReplayAttempt, logStripeReplayFetchFailure } from "@/lib/observability";

const routeLabel = "/api/admin/billing/stripe/replay";

type StripeEventRow = {
  event_id: string;
  status?: string | null;
  reason?: string | null;
  processed_at?: string | null;
  mode?: string | null;
  replay_count?: number | null;
};

export async function POST(request: Request) {
  const startTime = Date.now();
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role key missing" }, { status: 503 });
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const eventId = body?.event_id;
  if (!eventId || typeof eventId !== "string") {
    return NextResponse.json({ error: "event_id is required" }, { status: 400 });
  }

  const adminClient = createServiceRoleClient();
  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
      };
    };
  };
  const { data: eventRow } = await adminClient
    .from("stripe_webhook_events")
    .select("event_id, status, reason, processed_at, mode, replay_count")
    .eq("event_id", eventId)
    .maybeSingle();

  if (!eventRow) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { stripeMode } = await getProviderModes();
  const resolvedMode = resolveReplayMode((eventRow as StripeEventRow).mode, stripeMode);
  const stripeConfig = getStripeConfigForMode(resolvedMode);
  if (!stripeConfig.secretKey) {
    return NextResponse.json({ error: "Stripe not configured for replay" }, { status: 503 });
  }

  const stripe = getStripeClient(stripeConfig.secretKey);
  let stripeEvent;
  try {
    stripeEvent = await stripe.events.retrieve(eventId);
  } catch (error) {
    logStripeReplayFetchFailure({
      route: routeLabel,
      eventId,
      mode: resolvedMode,
      error,
    });
    await adminDb
      .from("stripe_webhook_events")
      .update({
        last_replay_at: new Date().toISOString(),
        last_replay_status: "failed",
        last_replay_reason: "stripe_fetch_failed",
        replay_count: ((eventRow as StripeEventRow).replay_count ?? 0) + 1,
      })
      .eq("event_id", eventId);
    return NextResponse.json({ error: "Unable to fetch Stripe event" }, { status: 502 });
  }

  if (isReplayAlreadyProcessed(eventRow as StripeEventRow)) {
    await adminDb
      .from("stripe_webhook_events")
      .update({
        last_replay_at: new Date().toISOString(),
        last_replay_status: "already_processed",
        last_replay_reason: (eventRow as StripeEventRow).reason ?? null,
        replay_count: ((eventRow as StripeEventRow).replay_count ?? 0) + 1,
      })
      .eq("event_id", eventId);
    logStripeReplayAttempt({
      route: routeLabel,
      eventId,
      mode: resolvedMode,
      outcome: "already_processed",
    });
    return NextResponse.json({ ok: true, status: "already_processed" });
  }

  const outcome = await processStripeEvent(
    {
      adminClient,
      stripe,
      route: routeLabel,
      startTime,
    },
    stripeEvent
  );

  const shouldStamp = shouldMarkWebhookProcessed({
    applied: outcome.applied,
    status: outcome.status,
    reason: outcome.reason,
  });

  await adminDb
    .from("stripe_webhook_events")
    .update({
      status: outcome.status,
      reason: outcome.reason,
      processed_at: shouldStamp ? new Date().toISOString() : null,
      profile_id: outcome.profileId,
      plan_tier: outcome.planTier,
      stripe_customer_id: outcome.customerId,
      stripe_subscription_id: outcome.subscriptionId,
      stripe_price_id: outcome.priceId,
      mode: stripeEvent.livemode ? "live" : "test",
      last_replay_at: new Date().toISOString(),
      last_replay_status: outcome.status,
      last_replay_reason: outcome.reason,
      replay_count: ((eventRow as StripeEventRow).replay_count ?? 0) + 1,
    })
    .eq("event_id", eventId);

  logStripeReplayAttempt({
    route: routeLabel,
    eventId,
    mode: resolvedMode,
    outcome: outcome.status,
  });

  return NextResponse.json({ ok: true, status: outcome.status, reason: outcome.reason });
}
