import { NextResponse } from "next/server";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getPaystackServerConfig } from "@/lib/billing/paystack";
import {
  finalizePaystackSubscriptionEvent,
  getPaystackSubscriptionEventByReference,
} from "@/lib/billing/paystack-subscriptions.server";
import { consumeListingCredit } from "@/lib/billing/listing-credits.server";
import { consumeFeaturedCredit } from "@/lib/billing/featured-credits.server";
import { getFeaturedConfig } from "@/lib/billing/featured";
import { logFailure } from "@/lib/observability";
import { logPropertyEvent } from "@/lib/analytics/property-events.server";
import { issueReferralRewardsForEvent } from "@/lib/referrals/referrals.server";

type PaystackPayload = {
  event?: string | null;
  data?: {
    reference?: string | null;
    status?: string | null;
    amount?: number | null;
    metadata?: Record<string, unknown> | null;
  } | null;
};

type PaymentRow = {
  id: string;
  user_id: string;
  listing_id: string;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  idempotency_key?: string | null;
};

const routeLabel = "/api/billing/webhook";

export type BillingWebhookRouteDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  getProviderModes: typeof getProviderModes;
  getPaystackServerConfig: typeof getPaystackServerConfig;
  createServiceRoleClient: typeof createServiceRoleClient;
  getPaystackSubscriptionEventByReference: typeof getPaystackSubscriptionEventByReference;
  finalizePaystackSubscriptionEvent: typeof finalizePaystackSubscriptionEvent;
  consumeListingCredit: typeof consumeListingCredit;
  consumeFeaturedCredit: typeof consumeFeaturedCredit;
  getFeaturedConfig: typeof getFeaturedConfig;
  logFailure: typeof logFailure;
  logPropertyEvent: typeof logPropertyEvent;
  issueReferralRewardsForEvent: typeof issueReferralRewardsForEvent;
};

const defaultDeps: BillingWebhookRouteDeps = {
  hasServiceRoleEnv,
  getProviderModes,
  getPaystackServerConfig,
  createServiceRoleClient,
  getPaystackSubscriptionEventByReference,
  finalizePaystackSubscriptionEvent,
  consumeListingCredit,
  consumeFeaturedCredit,
  getFeaturedConfig,
  logFailure,
  logPropertyEvent,
  issueReferralRewardsForEvent,
};

export async function postBillingWebhookResponse(
  request: Request,
  deps: BillingWebhookRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const { paystackMode } = await deps.getProviderModes();
  const config = await deps.getPaystackServerConfig(paystackMode);
  if (!config.keyPresent) {
    return NextResponse.json({ error: "Paystack not configured" }, { status: 503 });
  }

  const signature = request.headers.get("x-paystack-signature");
  const rawBody = await request.text();
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }
  const computed = crypto
    .createHmac("sha512", config.webhookSecret || "")
    .update(rawBody)
    .digest("hex");
  if (computed !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: PaystackPayload;
  try {
    payload = JSON.parse(rawBody) as PaystackPayload;
  } catch {
    return NextResponse.json({ ok: true });
  }
  const event = payload?.event ?? null;
  if (!event) {
    return NextResponse.json({ ok: true });
  }

  if (event !== "charge.success") {
    return NextResponse.json({ ok: true });
  }

  const reference = payload?.data?.reference ?? null;
  if (!reference) {
    return NextResponse.json({ ok: true });
  }

  const adminClient = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
  const { data: payment, error: paymentError } = await adminClient
    .from("listing_payments")
    .select("id, user_id, listing_id, status, amount, currency, idempotency_key")
    .eq("provider", "paystack")
    .eq("provider_ref", reference)
    .maybeSingle();

  const typedPayment = payment as PaymentRow | null;

  let isFeaturedPurchase = false;
  let typedFeaturePurchase: PaymentRow | null = null;

  if (!typedPayment) {
    const { data: featureRow } = await adminClient
      .from("feature_purchases")
      .select("id, user_id, listing_id, status, amount, currency, idempotency_key")
      .eq("provider", "paystack")
      .eq("provider_ref", reference)
      .maybeSingle();
    typedFeaturePurchase = featureRow as PaymentRow | null;
    isFeaturedPurchase = !!typedFeaturePurchase;
  }

  if (paymentError || (!typedPayment && !typedFeaturePurchase)) {
    const subscriptionEvent = await deps.getPaystackSubscriptionEventByReference({
      adminClient,
      reference,
    });

    if (subscriptionEvent) {
      const result = await deps.finalizePaystackSubscriptionEvent({
        adminClient,
        reference,
        event: subscriptionEvent,
        actorUserId: null,
      });

      if (result.status === "verified" || result.status === "already_processed" || result.status === "skipped") {
        return NextResponse.json({
          ok: true,
          subscription: true,
          status: result.status,
          valid_until: result.validUntil,
        });
      }

      if (result.retryable) {
        deps.logFailure({
          request,
          route: routeLabel,
          status: result.httpStatus,
          startTime,
          error: result.reason,
        });
        return NextResponse.json(
          { ok: false, subscription: true, error: result.reason },
          { status: result.httpStatus }
        );
      }

      return NextResponse.json({
        ok: true,
        subscription: true,
        status: result.status,
        reason: result.reason,
      });
    }

    deps.logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      level: "warn",
      error: paymentError || "listing_payment_not_found",
    });
    return NextResponse.json({ ok: true });
  }

  if (!isFeaturedPurchase && typedPayment?.status === "paid") {
    try {
      await deps.issueReferralRewardsForEvent({
        client: adminClient as unknown as SupabaseClient,
        referredUserId: typedPayment.user_id,
        eventType: "payg_listing_fee_paid",
        eventReference: `paystack:${reference}`,
      });
    } catch {
      // Referral rewards should never block payment webhooks.
    }
    return NextResponse.json({ ok: true });
  }

  if (isFeaturedPurchase && typedFeaturePurchase?.status === "paid") {
    try {
      await deps.issueReferralRewardsForEvent({
        client: adminClient as unknown as SupabaseClient,
        referredUserId: typedFeaturePurchase.user_id,
        eventType: "featured_purchase_paid",
        eventReference: `paystack:${reference}`,
      });
    } catch {
      // Referral rewards should never block payment webhooks.
    }
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await adminClient
    .from(isFeaturedPurchase ? "feature_purchases" : "listing_payments")
    .update({ status: "paid", paid_at: now, updated_at: now })
    .eq("id", isFeaturedPurchase ? typedFeaturePurchase!.id : typedPayment!.id);

  if (updateError) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: updateError,
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  let existingConsumption: { id: string } | null = null;
  const idempotencyKey = isFeaturedPurchase
    ? typedFeaturePurchase?.idempotency_key ?? null
    : typedPayment?.idempotency_key ?? null;
  if (idempotencyKey) {
    const { data } = await adminClient
      .from(isFeaturedPurchase ? "featured_credit_consumptions" : "listing_credit_consumptions")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    existingConsumption = (data as { id?: string } | null)?.id ? { id: (data as { id: string }).id } : null;
  }

  if (!existingConsumption) {
    if (!idempotencyKey) {
      deps.logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        level: "warn",
        error: "missing_idempotency_key",
      });
      return NextResponse.json({ ok: true });
    }

    if (isFeaturedPurchase && typedFeaturePurchase) {
      const featuredConfig = await deps.getFeaturedConfig();
      await adminClient.from("featured_credits").insert({
        user_id: typedFeaturePurchase.user_id,
        source: "payg",
        credits_total: 1,
        credits_used: 0,
        created_at: now,
        updated_at: now,
      });

      const consumed = await deps.consumeFeaturedCredit({
        client: adminClient as unknown as SupabaseClient,
        userId: typedFeaturePurchase.user_id,
        listingId: typedFeaturePurchase.listing_id,
        idempotencyKey,
      });

      if (consumed.ok && consumed.consumed) {
        const until = new Date(Date.now() + featuredConfig.durationDays * 24 * 60 * 60 * 1000).toISOString();
        await adminClient.from("properties").update({
          is_featured: true,
          featured_until: until,
          featured_at: now,
          featured_by: typedFeaturePurchase.user_id,
          updated_at: now,
        }).eq("id", typedFeaturePurchase.listing_id);
        await adminClient.from("feature_purchases").update({ featured_until: until }).eq("id", typedFeaturePurchase.id);
      }
    } else if (typedPayment) {
      await adminClient.from("listing_credits").insert({
        user_id: typedPayment.user_id,
        source: "payg",
        credits_total: 1,
        credits_used: 0,
        created_at: now,
        updated_at: now,
      });

      const consumed = await deps.consumeListingCredit({
        client: adminClient as unknown as SupabaseClient,
        userId: typedPayment.user_id,
        listingId: typedPayment.listing_id,
        idempotencyKey,
      });

      if (consumed.ok) {
        if (consumed.consumed) {
          await deps.logPropertyEvent({
            supabase: adminClient as unknown as SupabaseClient,
            propertyId: typedPayment.listing_id,
            eventType: "listing_credit_consumed",
            actorUserId: typedPayment.user_id,
            actorRole: null,
            sessionKey: null,
            meta: { source: consumed.source ?? null },
          });
        }
        await adminClient.from("properties").update({
          status: "pending",
          is_active: true,
          is_approved: false,
          approved_at: null,
          rejected_at: null,
          paused_at: null,
          paused_reason: null,
          expired_at: null,
          expires_at: null,
          submitted_at: now,
          status_updated_at: now,
          updated_at: now,
        }).eq("id", typedPayment.listing_id);
      }
    }
  }

  const eventListingId = isFeaturedPurchase ? typedFeaturePurchase!.listing_id : typedPayment!.listing_id;
  const eventUserId = isFeaturedPurchase ? typedFeaturePurchase!.user_id : typedPayment!.user_id;
  const eventAmount = isFeaturedPurchase ? typedFeaturePurchase!.amount : typedPayment!.amount;
  const eventCurrency = isFeaturedPurchase ? typedFeaturePurchase!.currency : typedPayment!.currency;

  await deps.logPropertyEvent({
    supabase: adminClient as unknown as SupabaseClient,
    propertyId: eventListingId,
    eventType: "listing_payment_succeeded",
    actorUserId: eventUserId,
    actorRole: null,
    sessionKey: null,
    meta: { provider: "paystack", amount: eventAmount, currency: eventCurrency },
  });

  try {
    if (!isFeaturedPurchase && typedPayment) {
      await deps.issueReferralRewardsForEvent({
        client: adminClient as unknown as SupabaseClient,
        referredUserId: typedPayment.user_id,
        eventType: "payg_listing_fee_paid",
        eventReference: `paystack:${reference}`,
      });
    }
    if (isFeaturedPurchase && typedFeaturePurchase) {
      await deps.issueReferralRewardsForEvent({
        client: adminClient as unknown as SupabaseClient,
        referredUserId: typedFeaturePurchase.user_id,
        eventType: "featured_purchase_paid",
        eventReference: `paystack:${reference}`,
      });
    }
  } catch {
    // Referral rewards should never block payment webhooks.
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  return postBillingWebhookResponse(request);
}
