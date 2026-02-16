import { NextResponse, type NextRequest } from "next/server";
import {
  hashWebhookPayload,
  insertPaymentWebhookEvent,
  markPaymentWebhookEventError,
  markPaymentWebhookEventProcessed,
} from "@/lib/payments/featured-payments-ops.server";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeClient, getStripeConfigForMode } from "@/lib/billing/stripe";
import { dispatchShortletPaymentSuccess } from "@/lib/shortlet/payment-success.server";
import {
  markShortletPaymentFailed,
  markShortletPaymentSucceededAndConfirmBooking,
} from "@/lib/shortlet/payments.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";

type StripeWebhookDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getProviderModes: typeof getProviderModes;
  getStripeConfigForMode: typeof getStripeConfigForMode;
  getStripeClient: typeof getStripeClient;
  hashWebhookPayload: typeof hashWebhookPayload;
  insertPaymentWebhookEvent: typeof insertPaymentWebhookEvent;
  markPaymentWebhookEventError: typeof markPaymentWebhookEventError;
  markPaymentWebhookEventProcessed: typeof markPaymentWebhookEventProcessed;
  markShortletPaymentFailed: typeof markShortletPaymentFailed;
  markShortletPaymentSucceededAndConfirmBooking: typeof markShortletPaymentSucceededAndConfirmBooking;
  dispatchShortletPaymentSuccess: typeof dispatchShortletPaymentSuccess;
};

const defaultDeps: StripeWebhookDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  getProviderModes,
  getStripeConfigForMode,
  getStripeClient,
  hashWebhookPayload,
  insertPaymentWebhookEvent,
  markPaymentWebhookEventError,
  markPaymentWebhookEventProcessed,
  markShortletPaymentFailed,
  markShortletPaymentSucceededAndConfirmBooking,
  dispatchShortletPaymentSuccess,
};

function resolveStripeReferenceFromEvent(event: Record<string, unknown>): string | null {
  const eventData = event.data as { object?: Record<string, unknown> } | undefined;
  const object = eventData?.object;
  if (!object) return null;
  const objectType = String(event.type || "");
  if (objectType.startsWith("checkout.session.")) {
    const sessionId = object.id;
    return typeof sessionId === "string" ? sessionId : null;
  }
  const metadata = object.metadata;
  if (metadata && typeof metadata === "object") {
    const candidate = (metadata as Record<string, unknown>).checkout_session_id;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return null;
}

export async function postStripeWebhookResponse(
  request: NextRequest,
  deps: StripeWebhookDeps = defaultDeps
) {
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 401 });
  }

  const modes = await deps.getProviderModes();
  const stripeConfig = deps.getStripeConfigForMode(modes.stripeMode);
  if (!stripeConfig.secretKey || !stripeConfig.webhookSecret) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const stripe = deps.getStripeClient(stripeConfig.secretKey);
  let event: Record<string, unknown>;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      stripeConfig.webhookSecret
    ) as unknown as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const eventType = String(event.type || "").trim().toLowerCase();
  const eventId = typeof event.id === "string" ? event.id : null;
  const reference = resolveStripeReferenceFromEvent(event);
  const payloadHash = deps.hashWebhookPayload(rawBody);
  const client = deps.createServiceRoleClient() as unknown as UntypedAdminClient;

  let webhookEventId: string | null = null;
  try {
    const inserted = await deps.insertPaymentWebhookEvent({
      client,
      provider: "stripe",
      event: eventType || null,
      eventId,
      reference,
      signature,
      payload: event,
      payloadHash,
    });
    webhookEventId = inserted.id;
    if (inserted.duplicate) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "webhook_insert_failed" },
      { status: 200 }
    );
  }

  if (!reference) {
    if (webhookEventId) {
      await deps.markPaymentWebhookEventProcessed({ client, id: webhookEventId });
    }
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    if (eventType === "checkout.session.async_payment_failed") {
      await deps.markShortletPaymentFailed({
        provider: "stripe",
        providerReference: reference,
        providerPayload: event,
        client: client as unknown as never,
      });
      if (webhookEventId) {
        await deps.markPaymentWebhookEventProcessed({ client, id: webhookEventId });
      }
      return NextResponse.json({ ok: true });
    }

    if (eventType !== "checkout.session.completed") {
      if (webhookEventId) {
        await deps.markPaymentWebhookEventProcessed({ client, id: webhookEventId });
      }
      return NextResponse.json({ ok: true, ignored: true });
    }

    const object = ((event.data as { object?: Record<string, unknown> } | undefined)?.object || {}) as Record<
      string,
      unknown
    >;
    const paymentStatus = String(object.payment_status || "").toLowerCase();
    if (paymentStatus && paymentStatus !== "paid") {
      await deps.markShortletPaymentFailed({
        provider: "stripe",
        providerReference: reference,
        providerPayload: event,
        client: client as unknown as never,
      });
      if (webhookEventId) {
        await deps.markPaymentWebhookEventProcessed({ client, id: webhookEventId });
      }
      return NextResponse.json({ ok: true, status: paymentStatus });
    }

    const paid = await deps.markShortletPaymentSucceededAndConfirmBooking({
      provider: "stripe",
      providerReference: reference,
      providerPayload: event,
      client: client as unknown as never,
    });

    if (!paid.ok) {
      if (webhookEventId) {
        await deps.markPaymentWebhookEventError({
          client,
          id: webhookEventId,
          error: paid.reason,
        });
      }
      return NextResponse.json({ ok: true, status: paid.reason });
    }

    if (paid.booking.transitioned) {
      await deps.dispatchShortletPaymentSuccess({
        bookingId: paid.booking.bookingId,
        propertyId: paid.booking.propertyId,
        hostUserId: paid.booking.hostUserId,
        guestUserId: paid.booking.guestUserId,
        listingTitle: paid.booking.listingTitle,
        city: paid.booking.city,
        checkIn: paid.booking.checkIn,
        checkOut: paid.booking.checkOut,
        nights: paid.booking.nights,
        amountMinor: paid.booking.totalAmountMinor,
        currency: paid.booking.currency,
        bookingStatus:
          paid.booking.status === "confirmed" || paid.booking.status === "completed"
            ? "confirmed"
            : "pending",
      });
    }

    if (webhookEventId) {
      await deps.markPaymentWebhookEventProcessed({ client, id: webhookEventId });
    }

    return NextResponse.json({ ok: true, idempotent: !paid.booking.transitioned });
  } catch (error) {
    if (webhookEventId) {
      await deps.markPaymentWebhookEventError({
        client,
        id: webhookEventId,
        error: error instanceof Error ? error.message : "stripe_webhook_error",
      });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "stripe_webhook_error" },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  return postStripeWebhookResponse(request);
}
