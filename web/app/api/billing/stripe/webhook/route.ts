import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeClient, getStripeConfigForMode } from "@/lib/billing/stripe";
import { constructStripeEvent } from "@/lib/billing/stripe-webhook";
import { parseWebhookInsertError, shouldMarkWebhookProcessed } from "@/lib/billing/stripe-webhook-events";
import {
  buildCanadaRentalPaygEntitlementGrantContract,
  buildCanadaRentalPaygPaymentPersistenceContract,
  validateCanadaRentalPaygWebhookContract,
} from "@/lib/billing/canada-payg-webhook-contract.server";
import {
  buildCanadaRentalPaygFulfilmentPlan,
  executeCanadaRentalPaygFulfilmentPayloads,
} from "@/lib/billing/canada-payg-fulfilment.server";
import {
  getCanadaRentalPaygEntitlementGrantEnabled,
  getCanadaRentalPaygPaymentPersistenceEnabled,
  getCanadaRentalPaygRuntimeEnabled,
  getCanadaRentalPaygWebhookFulfilmentEnabled,
} from "@/lib/billing/canada-payg-runtime.server";
import { processStripeEvent } from "@/lib/billing/stripe-event-processor";
import { logFailure, logOperationalEvent, logStripeWebhookApplied } from "@/lib/observability";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/billing/stripe/webhook";

type StripeWebhookEventAuditRow = {
  event_id?: string | null;
  status?: string | null;
  reason?: string | null;
  processed_at?: string | null;
  replay_count?: number | null;
};

type StripeWebhookRouteProcessResult = {
  status: "processed" | "ignored" | "failed" | "error";
  reason: string | null;
  profileId: string | null;
  planTier: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  priceId: string | null;
  applied: boolean;
};

export type BillingStripeWebhookRouteDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  getProviderModes: typeof getProviderModes;
  getStripeConfigForMode: typeof getStripeConfigForMode;
  constructStripeEvent: typeof constructStripeEvent;
  createServiceRoleClient: typeof createServiceRoleClient;
  getStripeClient: typeof getStripeClient;
  processStripeEvent: typeof processStripeEvent;
  getCanadaRentalPaygRuntimeEnabled: typeof getCanadaRentalPaygRuntimeEnabled;
  getCanadaRentalPaygWebhookFulfilmentEnabled: typeof getCanadaRentalPaygWebhookFulfilmentEnabled;
  getCanadaRentalPaygPaymentPersistenceEnabled: typeof getCanadaRentalPaygPaymentPersistenceEnabled;
  getCanadaRentalPaygEntitlementGrantEnabled: typeof getCanadaRentalPaygEntitlementGrantEnabled;
  validateCanadaRentalPaygWebhookContract: typeof validateCanadaRentalPaygWebhookContract;
  buildCanadaRentalPaygPaymentPersistenceContract: typeof buildCanadaRentalPaygPaymentPersistenceContract;
  buildCanadaRentalPaygEntitlementGrantContract: typeof buildCanadaRentalPaygEntitlementGrantContract;
  executeCanadaRentalPaygFulfilmentPayloads: typeof executeCanadaRentalPaygFulfilmentPayloads;
  logFailure: typeof logFailure;
  logOperationalEvent: typeof logOperationalEvent;
  logStripeWebhookApplied: typeof logStripeWebhookApplied;
};

const defaultDeps: BillingStripeWebhookRouteDeps = {
  hasServiceRoleEnv,
  getProviderModes,
  getStripeConfigForMode,
  constructStripeEvent,
  createServiceRoleClient,
  getStripeClient,
  processStripeEvent,
  getCanadaRentalPaygRuntimeEnabled,
  getCanadaRentalPaygWebhookFulfilmentEnabled,
  getCanadaRentalPaygPaymentPersistenceEnabled,
  getCanadaRentalPaygEntitlementGrantEnabled,
  validateCanadaRentalPaygWebhookContract,
  buildCanadaRentalPaygPaymentPersistenceContract,
  buildCanadaRentalPaygEntitlementGrantContract,
  executeCanadaRentalPaygFulfilmentPayloads,
  logFailure,
  logOperationalEvent,
  logStripeWebhookApplied,
};

function normalizeUpper(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized.length ? normalized : null;
}

function normalizeLower(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.length ? normalized : null;
}

function extractStripeEventMarket(event: Stripe.Event) {
  const eventObject = event.data.object as { metadata?: Stripe.Metadata | null };
  const metadata = eventObject?.metadata;
  const marketCountryRaw = metadata?.subscription_market_country ?? metadata?.market ?? null;
  const marketCurrencyRaw = metadata?.subscription_market_currency ?? metadata?.currency ?? null;
  const marketCountry =
    typeof marketCountryRaw === "string" && /^[A-Z]{2}$/i.test(marketCountryRaw)
      ? marketCountryRaw.toUpperCase()
      : null;
  const marketCurrency =
    typeof marketCurrencyRaw === "string" && /^[A-Z]{3}$/i.test(marketCurrencyRaw)
      ? marketCurrencyRaw.toUpperCase()
      : null;
  return { marketCountry, marketCurrency };
}

function isCanadaRentalPaygCheckoutEvent(event: Stripe.Event) {
  if (event.type !== "checkout.session.completed") return false;
  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata ?? null;
  return (
    session.mode === "payment" &&
    normalizeUpper(metadata?.market) === "CA" &&
    normalizeLower(metadata?.provider) === "stripe" &&
    normalizeLower(metadata?.purpose) === "listing_submission"
  );
}

async function recordStripeWebhookEvent(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  event: Stripe.Event
) {
  const market = extractStripeEventMarket(event);
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
      reason: null,
      mode: event.livemode ? "live" : "test",
      subscription_market_country: market.marketCountry,
      subscription_market_currency: market.marketCurrency,
    });
  return parseWebhookInsertError(error as { code?: string } | null);
}

async function getStripeWebhookEventRecord(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  eventId: string
): Promise<StripeWebhookEventAuditRow | null> {
  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: StripeWebhookEventAuditRow | null; error: { message?: string } | null }>;
        };
      };
    };
  };

  const { data } = await adminDb
    .from("stripe_webhook_events")
    .select("event_id,status,reason,processed_at,replay_count")
    .eq("event_id", eventId)
    .maybeSingle();

  return data ?? null;
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

async function loadCanadaWebhookListingContext(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  listingId: string
) {
  const adminDb = adminClient as unknown as UntypedAdminClient;
  const { data, error } = await adminDb
    .from("properties")
    .select("id,owner_id,country_code,listing_intent,rental_type")
    .eq("id", listingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Canada PAYG listing lookup failed");
  }

  if (!data) return null;

  return {
    id: String((data as Record<string, unknown>).id ?? ""),
    ownerId:
      typeof (data as Record<string, unknown>).owner_id === "string"
        ? ((data as Record<string, unknown>).owner_id as string)
        : null,
    countryCode:
      typeof (data as Record<string, unknown>).country_code === "string"
        ? ((data as Record<string, unknown>).country_code as string)
        : null,
    listingIntent:
      typeof (data as Record<string, unknown>).listing_intent === "string"
        ? ((data as Record<string, unknown>).listing_intent as string)
        : null,
    rentalType:
      typeof (data as Record<string, unknown>).rental_type === "string"
        ? ((data as Record<string, unknown>).rental_type as string)
        : null,
  };
}

async function processCanadaRentalPaygWebhook(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  event: Stripe.Event,
  deps: BillingStripeWebhookRouteDeps
): Promise<StripeWebhookRouteProcessResult> {
  const runtimeGateEnabled = await deps.getCanadaRentalPaygRuntimeEnabled(adminClient as never);
  if (!runtimeGateEnabled) {
    return {
      status: "ignored",
      reason: "canada_runtime_disabled",
      profileId: null,
      planTier: null,
      customerId: null,
      subscriptionId: null,
      priceId: null,
      applied: false,
    };
  }

  const webhookFulfilmentGateEnabled = await deps.getCanadaRentalPaygWebhookFulfilmentEnabled(
    adminClient as never
  );
  if (!webhookFulfilmentGateEnabled) {
    return {
      status: "ignored",
      reason: "canada_webhook_fulfilment_disabled",
      profileId: null,
      planTier: null,
      customerId: null,
      subscriptionId: null,
      priceId: null,
      applied: false,
    };
  }

  const paymentPersistenceGateEnabled = await deps.getCanadaRentalPaygPaymentPersistenceEnabled(
    adminClient as never
  );
  if (!paymentPersistenceGateEnabled) {
    return {
      status: "ignored",
      reason: "canada_payment_persistence_disabled",
      profileId: null,
      planTier: null,
      customerId: null,
      subscriptionId: null,
      priceId: null,
      applied: false,
    };
  }

  const entitlementGrantGateEnabled = await deps.getCanadaRentalPaygEntitlementGrantEnabled(
    adminClient as never
  );
  if (!entitlementGrantGateEnabled) {
    return {
      status: "ignored",
      reason: "canada_entitlement_grant_disabled",
      profileId: null,
      planTier: null,
      customerId: null,
      subscriptionId: null,
      priceId: null,
      applied: false,
    };
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const listingId = typeof session.metadata?.listing_id === "string" ? session.metadata.listing_id : "";
  const listing = listingId ? await loadCanadaWebhookListingContext(adminClient, listingId) : null;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent && typeof session.payment_intent === "object" && "id" in session.payment_intent
      ? String(session.payment_intent.id)
      : null;

  const validation = deps.validateCanadaRentalPaygWebhookContract({
    event,
    listing,
    checkoutSessionId: session.id,
    paymentIntentId,
  });

  if (!validation.ok) {
    return {
      status: "ignored",
      reason: validation.reasonCode,
      profileId: validation.parsedMetadata?.ownerId ?? listing?.ownerId ?? null,
      planTier: validation.parsedMetadata?.tier ?? null,
      customerId: null,
      subscriptionId: null,
      priceId: null,
      applied: false,
    };
  }

  const paymentContract = deps.buildCanadaRentalPaygPaymentPersistenceContract(validation, {
    event,
    checkoutSessionId: session.id,
    paymentIntentId,
  });
  const entitlementContract = deps.buildCanadaRentalPaygEntitlementGrantContract(validation, {
    event,
    checkoutSessionId: session.id,
    paymentIntentId,
  });

  const execution = await deps.executeCanadaRentalPaygFulfilmentPayloads({
    plan: buildCanadaRentalPaygFulfilmentPlan(validation.fulfilmentValidation),
    paymentContract,
    entitlementContract,
    client: adminClient as never,
    paymentPersistenceEnabled: paymentPersistenceGateEnabled,
    entitlementGrantEnabled: entitlementGrantGateEnabled,
  });

  const applied =
    (execution.paymentPersistence.inserted || execution.paymentPersistence.duplicate) &&
    (execution.entitlementGrant.inserted || execution.entitlementGrant.duplicate);

  return {
    status: applied ? "processed" : "failed",
    reason: applied ? null : "canada_mutation_incomplete",
    profileId: validation.parsedMetadata.ownerId ?? listing?.ownerId ?? null,
    planTier: validation.parsedMetadata.tier ?? null,
    customerId: null,
    subscriptionId: null,
    priceId: null,
    applied,
  };
}

export async function postBillingStripeWebhookResponse(
  request: Request,
  deps: BillingStripeWebhookRouteDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Supabase service role missing" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  let event: Stripe.Event;

  const { stripeMode } = await deps.getProviderModes();
  const stripeConfig = deps.getStripeConfigForMode(stripeMode, "billing");
  if (!stripeConfig.secretKey || !stripeConfig.webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  try {
    event = deps.constructStripeEvent(payload, signature, {
      secretKey: stripeConfig.secretKey,
      webhookSecret: stripeConfig.webhookSecret,
    });
  } catch (error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const adminClient = deps.createServiceRoleClient();
  const canadaEvent = isCanadaRentalPaygCheckoutEvent(event);
  const idempotency = await recordStripeWebhookEvent(adminClient, event);

  let duplicateEventRecord: StripeWebhookEventAuditRow | null = null;
  let replayingFailedCanadaEvent = false;
  if (idempotency.error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: idempotency.error,
    });
    return NextResponse.json({ error: "Webhook idempotency failed" }, { status: 500 });
  }
  if (idempotency.duplicate) {
    duplicateEventRecord = await getStripeWebhookEventRecord(adminClient, event.id);
    replayingFailedCanadaEvent =
      canadaEvent &&
      !duplicateEventRecord?.processed_at &&
      duplicateEventRecord?.status !== "processed" &&
      duplicateEventRecord?.status !== "ignored";

    if (!replayingFailedCanadaEvent) {
      deps.logOperationalEvent({
        request,
        route: routeLabel,
        event: "stripe_webhook_duplicate",
        details: {
          eventType: event.type,
          eventId: event.id,
        },
      });
      return NextResponse.json({ received: true });
    }
  }

  const stripe = deps.getStripeClient(stripeConfig.secretKey);

  try {
    const market = extractStripeEventMarket(event);
    const outcome = canadaEvent
      ? await processCanadaRentalPaygWebhook(adminClient, event, deps)
      : await deps.processStripeEvent(
          {
            adminClient,
            stripe,
            route: routeLabel,
            startTime,
            request,
          },
          event
        );

    const shouldStamp = canadaEvent
      ? outcome.status === "processed" || outcome.status === "ignored"
      : shouldMarkWebhookProcessed({
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
      subscription_market_country: market.marketCountry,
      subscription_market_currency: market.marketCurrency,
      replay_count: replayingFailedCanadaEvent ? (duplicateEventRecord?.replay_count ?? 0) + 1 : undefined,
      last_replay_at: replayingFailedCanadaEvent ? new Date().toISOString() : undefined,
      last_replay_status: replayingFailedCanadaEvent ? outcome.status : undefined,
      last_replay_reason: replayingFailedCanadaEvent ? outcome.reason : undefined,
    });

    deps.logStripeWebhookApplied({
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
      replay_count: replayingFailedCanadaEvent ? (duplicateEventRecord?.replay_count ?? 0) + 1 : undefined,
      last_replay_at: replayingFailedCanadaEvent ? new Date().toISOString() : undefined,
      last_replay_status: replayingFailedCanadaEvent ? "failed" : undefined,
      last_replay_reason: replayingFailedCanadaEvent ? "handler_error" : undefined,
    });
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return postBillingStripeWebhookResponse(request);
}
