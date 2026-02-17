import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { getPaystackServerConfig, hasPaystackServerEnv, verifyTransaction } from "@/lib/payments/paystack.server";
import { dispatchShortletPaymentSuccess } from "@/lib/shortlet/payment-success.server";
import {
  getShortletPaymentCheckoutContextByBookingId,
  markShortletPaymentFailed,
  markShortletPaymentSucceededAndConfirmBooking,
  resolveShortletBookingIdFromPaystackPayload,
  upsertShortletPaymentIntent,
} from "@/lib/shortlet/payments.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const routeLabel = "/api/shortlet/payments/paystack/verify";
const VERIFY_MIN_INTERVAL_MS = 1500;
const verifyRequestGuard = new Map<string, number>();

const querySchema = z.object({
  reference: z.string().min(8),
  booking_id: z.string().uuid().optional(),
});

type VerifyShortletPaystackDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  hasPaystackServerEnv: typeof hasPaystackServerEnv;
  requireRole: typeof requireRole;
  getPaystackServerConfig: typeof getPaystackServerConfig;
  verifyTransaction: typeof verifyTransaction;
  getShortletPaymentCheckoutContextByBookingId: typeof getShortletPaymentCheckoutContextByBookingId;
  resolveShortletBookingIdFromPaystackPayload: typeof resolveShortletBookingIdFromPaystackPayload;
  upsertShortletPaymentIntent: typeof upsertShortletPaymentIntent;
  markShortletPaymentFailed: typeof markShortletPaymentFailed;
  markShortletPaymentSucceededAndConfirmBooking: typeof markShortletPaymentSucceededAndConfirmBooking;
  dispatchShortletPaymentSuccess: typeof dispatchShortletPaymentSuccess;
};

const defaultDeps: VerifyShortletPaystackDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  hasPaystackServerEnv,
  requireRole,
  getPaystackServerConfig,
  verifyTransaction,
  getShortletPaymentCheckoutContextByBookingId,
  resolveShortletBookingIdFromPaystackPayload,
  upsertShortletPaymentIntent,
  markShortletPaymentFailed,
  markShortletPaymentSucceededAndConfirmBooking,
  dispatchShortletPaymentSuccess,
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

export async function getShortletPaystackVerifyResponse(
  request: NextRequest,
  deps: VerifyShortletPaystackDeps = defaultDeps
) {
  const startTime = Date.now();
  const referenceParam = request.nextUrl.searchParams.get("reference");
  const bookingParam =
    request.nextUrl.searchParams.get("booking_id") || request.nextUrl.searchParams.get("bookingId");
  console.log(`[${routeLabel}] start`, {
    bookingIdParam: bookingParam,
    referencePresent: Boolean(String(referenceParam || "").trim()),
  });
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }
  if (!deps.hasPaystackServerEnv()) {
    return NextResponse.json({ error: "Paystack is not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant", "landlord", "agent", "admin"],
  });
  if (!auth.ok) {
    console.warn(`[${routeLabel}] auth_failed`, {
      status: auth.response.status,
    });
    return auth.response;
  }

  const parsed = querySchema.safeParse({
    reference: request.nextUrl.searchParams.get("reference"),
    booking_id:
      request.nextUrl.searchParams.get("booking_id") || request.nextUrl.searchParams.get("bookingId"),
  });
  if (!parsed.success) {
    console.warn(`[${routeLabel}] invalid_query`, {
      hasReference: Boolean(referenceParam),
    });
    return NextResponse.json({ error: "reference is required" }, { status: 422 });
  }

  const guardKey = `${auth.user.id}:${parsed.data.reference}`;
  const nowMs = Date.now();
  const lastRunMs = verifyRequestGuard.get(guardKey) ?? 0;
  verifyRequestGuard.set(guardKey, nowMs);
  if (lastRunMs && nowMs - lastRunMs < VERIFY_MIN_INTERVAL_MS) {
    console.log(`[${routeLabel}] throttled`, {
      reference: parsed.data.reference,
      deltaMs: nowMs - lastRunMs,
    });
    return NextResponse.json({ ok: true, status: "throttled" }, { status: 202 });
  }

  try {
    const adminClient = deps.createServiceRoleClient();
    const paystackConfig = deps.getPaystackServerConfig();
    const verified = await deps.verifyTransaction({
      secretKey: paystackConfig.secretKey || "",
      reference: parsed.data.reference,
    });
    const providerPayload = asObject(verified.raw);
    const bookingId =
      parsed.data.booking_id ||
      deps.resolveShortletBookingIdFromPaystackPayload({
        reference: parsed.data.reference,
        payload: providerPayload,
      });

    if (!bookingId) {
      console.error(`[${routeLabel}] booking_id_unresolved`, {
        reference: parsed.data.reference,
      });
      return NextResponse.json(
        { error: "SHORTLET_BOOKING_NOT_FOUND", reason: "booking_id_unresolved" },
        { status: 404 }
      );
    }

    const booking = await deps.getShortletPaymentCheckoutContextByBookingId({
      bookingId,
      client: adminClient,
    });
    if (!booking) {
      console.error(`[${routeLabel}] booking_not_found`, {
        bookingId,
        reference: parsed.data.reference,
      });
      return NextResponse.json({ error: "SHORTLET_BOOKING_NOT_FOUND" }, { status: 404 });
    }

    if (auth.role !== "admin" && booking.guestUserId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const paymentCurrency = String(verified.currency || booking.currency || "NGN").toUpperCase();
    const paymentAmountMinor = Math.max(0, Math.trunc(Number(verified.amountMinor || 0)));

    if (!verified.ok) {
      await deps.markShortletPaymentFailed({
        provider: "paystack",
        providerReference: parsed.data.reference,
        providerPayload,
        client: adminClient,
      });
      console.log(`[${routeLabel}] verification_failed`, {
        bookingId,
        reference: parsed.data.reference,
      });
      return NextResponse.json({ ok: false, status: "verification_failed" }, { status: 409 });
    }

    if (
      paymentAmountMinor <= 0 ||
      paymentAmountMinor !== Number(booking.totalAmountMinor || 0) ||
      paymentCurrency !== String(booking.currency || "").toUpperCase()
    ) {
      await deps.markShortletPaymentFailed({
        provider: "paystack",
        providerReference: parsed.data.reference,
        providerPayload,
        client: adminClient,
      });
      console.error(`[${routeLabel}] amount_or_currency_mismatch`, {
        bookingId,
        reference: parsed.data.reference,
        expectedAmountMinor: booking.totalAmountMinor,
        receivedAmountMinor: paymentAmountMinor,
        expectedCurrency: booking.currency,
        receivedCurrency: paymentCurrency,
      });
      return NextResponse.json({ ok: false, status: "mismatch" }, { status: 409 });
    }

    const providerData = asObject(providerPayload.data);
    const authorization = asObject(providerData.authorization);

    await deps.upsertShortletPaymentIntent({
      booking,
      provider: "paystack",
      providerReference: parsed.data.reference,
      amountMinor: paymentAmountMinor,
      providerPayload: {
        ...providerPayload,
        paystack_transaction_id:
          typeof providerData.id === "number" || typeof providerData.id === "string"
            ? String(providerData.id)
            : null,
        gateway_response:
          typeof providerData.gateway_response === "string" ? providerData.gateway_response : null,
        authorization_code:
          typeof authorization.authorization_code === "string" ? authorization.authorization_code : null,
      },
      client: adminClient,
    });

    const paid = await deps.markShortletPaymentSucceededAndConfirmBooking({
      provider: "paystack",
      providerReference: parsed.data.reference,
      providerPayload,
      client: adminClient,
    });

    if (!paid.ok) {
      console.error(`[${routeLabel}] confirmation_failed`, {
        bookingId,
        reference: parsed.data.reference,
        reason: paid.reason,
      });
      return NextResponse.json({ ok: false, status: paid.reason }, { status: 409 });
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

    console.log(`[${routeLabel}] confirmed`, {
      bookingId,
      reference: parsed.data.reference,
      transitioned: paid.booking.transitioned,
      bookingStatus: paid.booking.status,
    });
    return NextResponse.json({
      ok: true,
      booking_id: paid.booking.bookingId,
      booking_status: paid.booking.status,
      idempotent: !paid.booking.transitioned,
    });
  } catch (error) {
    console.error(`[${routeLabel}] failed`, {
      name: error instanceof Error ? error.name : "Error",
      error: error instanceof Error ? error.message : "verify_failed",
      stack: error instanceof Error ? error.stack : null,
      reference: request.nextUrl.searchParams.get("reference"),
    });
    return NextResponse.json({ error: "Unable to verify payment" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return getShortletPaystackVerifyResponse(request);
}
