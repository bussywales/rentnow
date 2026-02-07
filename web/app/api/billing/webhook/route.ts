import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getPaystackConfig } from "@/lib/billing/paystack";
import { consumeListingCredit } from "@/lib/billing/listing-credits.server";
import { logFailure } from "@/lib/observability";
import { logPropertyEvent } from "@/lib/analytics/property-events.server";

type PaystackPayload = {
  event?: string | null;
  data?: {
    reference?: string | null;
    status?: string | null;
    amount?: number | null;
    metadata?: Record<string, unknown> | null;
  } | null;
};

const routeLabel = "/api/billing/webhook";

export async function POST(request: Request) {
  const startTime = Date.now();
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const { paystackMode } = await getProviderModes();
  const config = await getPaystackConfig(paystackMode);
  if (!config.keyPresent) {
    return NextResponse.json({ error: "Paystack not configured" }, { status: 503 });
  }

  const signature = request.headers.get("x-paystack-signature");
  const rawBody = await request.text();
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }
  const computed = crypto
    .createHmac("sha512", config.secretKey || "")
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

  const adminClient = createServiceRoleClient();
  const { data: payment, error: paymentError } = await adminClient
    .from("listing_payments")
    .select("id, user_id, listing_id, status, amount, currency, idempotency_key")
    .eq("provider", "paystack")
    .eq("provider_ref", reference)
    .maybeSingle();

  if (paymentError || !payment) {
    logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      level: "warn",
      error: paymentError || "listing_payment_not_found",
    });
    return NextResponse.json({ ok: true });
  }

  if (payment.status === "paid") {
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await adminClient
    .from("listing_payments")
    .update({ status: "paid", paid_at: now, updated_at: now })
    .eq("id", payment.id);

  if (updateError) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: updateError,
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { data: existingConsumption } = await adminClient
    .from("listing_credit_consumptions")
    .select("id")
    .eq("idempotency_key", payment.idempotency_key)
    .maybeSingle();

  if (!existingConsumption) {
    await adminClient.from("listing_credits").insert({
      user_id: payment.user_id,
      source: "payg",
      credits_total: 1,
      credits_used: 0,
      created_at: now,
      updated_at: now,
    });

    const consumed = await consumeListingCredit({
      client: adminClient,
      userId: payment.user_id,
      listingId: payment.listing_id,
      idempotencyKey: payment.idempotency_key,
    });

    if (consumed.ok) {
      if (consumed.consumed) {
        await logPropertyEvent({
          supabase: adminClient,
          propertyId: payment.listing_id,
          eventType: "listing_credit_consumed",
          actorUserId: payment.user_id,
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
      }).eq("id", payment.listing_id);
    }
  }

  await logPropertyEvent({
    supabase: adminClient,
    propertyId: payment.listing_id,
    eventType: "listing_payment_succeeded",
    actorUserId: payment.user_id,
    actorRole: null,
    sessionKey: null,
    meta: { provider: "paystack", amount: payment.amount, currency: payment.currency },
  });

  return NextResponse.json({ ok: true });
}
