import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { getSiteUrl } from "@/lib/env";
import {
  getPaystackServerConfig,
  hasPaystackServerEnv,
  initializeTransaction,
} from "@/lib/payments/paystack.server";
import {
  deriveShortletAmountMinorFromNumericTotal,
  getShortletPaymentCheckoutContext,
  getShortletPaymentsProviderFlags,
  isBookingPayableStatus,
  isNigeriaShortlet,
  resolveCurrencyMinorUnit,
  upsertShortletPaymentIntent,
} from "@/lib/shortlet/payments.server";
import { hasServiceRoleEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const routeLabel = "/api/shortlet/payments/paystack/init";

const payloadSchema = z.object({
  booking_id: z.string().uuid(),
});

function buildReference(bookingId: string) {
  const compactBooking = bookingId.replace(/-/g, "").slice(0, 20);
  return `shb_ps_${compactBooking}_${Date.now()}`;
}

export type InitShortletPaystackDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  hasPaystackServerEnv: typeof hasPaystackServerEnv;
  requireRole: typeof requireRole;
  getShortletPaymentsProviderFlags: typeof getShortletPaymentsProviderFlags;
  getShortletPaymentCheckoutContext: typeof getShortletPaymentCheckoutContext;
  getSiteUrl: typeof getSiteUrl;
  getPaystackServerConfig: typeof getPaystackServerConfig;
  initializeTransaction: typeof initializeTransaction;
  upsertShortletPaymentIntent: typeof upsertShortletPaymentIntent;
};

const defaultDeps: InitShortletPaystackDeps = {
  hasServiceRoleEnv,
  hasPaystackServerEnv,
  requireRole,
  getShortletPaymentsProviderFlags,
  getShortletPaymentCheckoutContext,
  getSiteUrl,
  getPaystackServerConfig,
  initializeTransaction,
  upsertShortletPaymentIntent,
};

export async function postInitShortletPaystackResponse(
  request: NextRequest,
  deps: InitShortletPaystackDeps = defaultDeps
) {
  const startTime = Date.now();
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
  if (!auth.ok) return auth.response;

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const providerFlags = await deps.getShortletPaymentsProviderFlags();
  if (!providerFlags.paystackEnabled) {
    return NextResponse.json({ error: "Paystack checkout is currently disabled" }, { status: 409 });
  }

  const booking = await deps.getShortletPaymentCheckoutContext({
    bookingId: parsed.data.booking_id,
    guestUserId: auth.user.id,
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.payment?.status === "succeeded" || booking.status === "pending" || booking.status === "confirmed") {
    return NextResponse.json({ error: "Booking is already paid" }, { status: 409 });
  }

  if (!isBookingPayableStatus(booking.status)) {
    return NextResponse.json({ error: "Booking is not payable in the current status" }, { status: 409 });
  }

  const currency = isNigeriaShortlet(booking) ? "NGN" : booking.currency;
  const total = Number(booking.totalAmountMinor) / resolveCurrencyMinorUnit(currency);
  const amountMinor = deriveShortletAmountMinorFromNumericTotal({ total, currency });
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return NextResponse.json(
      {
        error: "Invalid booking total",
        code: "SHORTLET_INVALID_AMOUNT",
      },
      { status: 400 }
    );
  }

  const siteUrl = await deps.getSiteUrl();
  const reference = buildReference(booking.bookingId);
  const callbackUrl = `${siteUrl}/payments/shortlet/return?bookingId=${encodeURIComponent(
    booking.bookingId
  )}&provider=paystack&reference=${encodeURIComponent(reference)}`;

  try {
    const paystackConfig = deps.getPaystackServerConfig();
    const transaction = await deps.initializeTransaction({
      secretKey: paystackConfig.secretKey || "",
      amountMinor,
      email: auth.user.email || "",
      reference,
      callbackUrl,
      currency,
      metadata: {
        booking_id: booking.bookingId,
        property_id: booking.propertyId,
        guest_user_id: booking.guestUserId,
      },
    });

    await deps.upsertShortletPaymentIntent({
      booking,
      provider: "paystack",
      providerReference: transaction.reference,
      amountMinor,
      providerPayload: {
        access_code: transaction.accessCode,
        authorization_url: transaction.authorizationUrl,
      },
    });

    return NextResponse.json({
      ok: true,
      booking_id: booking.bookingId,
      provider: "paystack",
      reference: transaction.reference,
      authorization_url: transaction.authorizationUrl,
    });
  } catch (error) {
    const routeError = error as {
      message?: string;
      details?: string | null;
      hint?: string | null;
      code?: string | null;
      status?: number | null;
    };
    console.error("[shortlet-payments/paystack/init] failed", {
      bookingId: booking.bookingId,
      currency,
      total,
      supabaseError: {
        message: routeError?.message ?? null,
        details: routeError?.details ?? null,
        hint: routeError?.hint ?? null,
        code: routeError?.code ?? null,
        status: routeError?.status ?? null,
      },
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to initialize Paystack checkout",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return postInitShortletPaystackResponse(request);
}
