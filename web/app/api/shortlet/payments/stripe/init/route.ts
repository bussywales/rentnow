import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeClient, getStripeConfigForMode } from "@/lib/billing/stripe";
import { getSiteUrl } from "@/lib/env";
import {
  getShortletPaymentCheckoutContext,
  getShortletPaymentsProviderFlags,
  isBookingPayableStatus,
  isNigeriaShortlet,
  upsertShortletPaymentIntent,
} from "@/lib/shortlet/payments.server";
import { hasServiceRoleEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const routeLabel = "/api/shortlet/payments/stripe/init";

const payloadSchema = z.object({
  booking_id: z.string().uuid(),
});

export type InitShortletStripeDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  requireRole: typeof requireRole;
  getShortletPaymentsProviderFlags: typeof getShortletPaymentsProviderFlags;
  getShortletPaymentCheckoutContext: typeof getShortletPaymentCheckoutContext;
  getProviderModes: typeof getProviderModes;
  getStripeConfigForMode: typeof getStripeConfigForMode;
  getStripeClient: typeof getStripeClient;
  getSiteUrl: typeof getSiteUrl;
  upsertShortletPaymentIntent: typeof upsertShortletPaymentIntent;
};

const defaultDeps: InitShortletStripeDeps = {
  hasServiceRoleEnv,
  requireRole,
  getShortletPaymentsProviderFlags,
  getShortletPaymentCheckoutContext,
  getProviderModes,
  getStripeConfigForMode,
  getStripeClient,
  getSiteUrl,
  upsertShortletPaymentIntent,
};

export async function postInitShortletStripeResponse(
  request: NextRequest,
  deps: InitShortletStripeDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
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
  if (!providerFlags.stripeEnabled) {
    return NextResponse.json({ error: "Stripe checkout is currently disabled" }, { status: 409 });
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

  const amountMinor = Math.max(0, Math.trunc(booking.totalAmountMinor));
  if (amountMinor <= 0) {
    return NextResponse.json({ error: "Invalid booking total" }, { status: 409 });
  }

  try {
    const modes = await deps.getProviderModes();
    const stripeConfig = deps.getStripeConfigForMode(modes.stripeMode);
    if (!stripeConfig.secretKey) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const stripe = deps.getStripeClient(stripeConfig.secretKey);
    const siteUrl = await deps.getSiteUrl();
    const currency = isNigeriaShortlet(booking) ? "NGN" : booking.currency;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${siteUrl}/payments/shortlet/return?bookingId=${encodeURIComponent(
        booking.bookingId
      )}&provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payments/shortlet/checkout?bookingId=${encodeURIComponent(
        booking.bookingId
      )}&cancelled=1`,
      customer_email: auth.user.email || undefined,
      client_reference_id: booking.bookingId,
      metadata: {
        booking_id: booking.bookingId,
        property_id: booking.propertyId,
        guest_user_id: booking.guestUserId,
        source: "shortlet_booking",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: amountMinor,
            product_data: {
              name: booking.listingTitle || "Shortlet booking",
              description: `${booking.checkIn} to ${booking.checkOut} · ${booking.nights} night${
                booking.nights === 1 ? "" : "s"
              }`,
            },
          },
        },
      ],
    });

    if (!session.url || !session.id) {
      return NextResponse.json({ error: "Unable to initialize Stripe checkout" }, { status: 502 });
    }

    await deps.upsertShortletPaymentIntent({
      booking,
      provider: "stripe",
      providerReference: session.id,
      providerPayload: {
        checkout_session_id: session.id,
      },
    });

    return NextResponse.json({
      ok: true,
      booking_id: booking.bookingId,
      provider: "stripe",
      session_id: session.id,
      checkout_url: session.url,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to initialize Stripe checkout",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  return postInitShortletStripeResponse(request);
}
