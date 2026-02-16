import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { getShortletPaymentCheckoutContext } from "@/lib/shortlet/payments.server";
import { hasServiceRoleEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const routeLabel = "/api/shortlet/payments/status";
const querySchema = z.object({
  booking_id: z.string().uuid(),
});

export type ShortletPaymentStatusDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  requireRole: typeof requireRole;
  getShortletPaymentCheckoutContext: typeof getShortletPaymentCheckoutContext;
};

const defaultDeps: ShortletPaymentStatusDeps = {
  hasServiceRoleEnv,
  requireRole,
  getShortletPaymentCheckoutContext,
};

export async function getShortletPaymentStatusResponse(
  request: NextRequest,
  deps: ShortletPaymentStatusDeps = defaultDeps
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

  const parsed = querySchema.safeParse({
    booking_id:
      request.nextUrl.searchParams.get("booking_id") ||
      request.nextUrl.searchParams.get("bookingId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "booking_id is required" }, { status: 422 });
  }

  const booking = await deps.getShortletPaymentCheckoutContext({
    bookingId: parsed.data.booking_id,
    guestUserId: auth.user.id,
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    booking: {
      id: booking.bookingId,
      status: booking.status,
      booking_mode: booking.bookingMode,
      check_in: booking.checkIn,
      check_out: booking.checkOut,
      nights: booking.nights,
      total_amount_minor: booking.totalAmountMinor,
      currency: booking.currency,
      property_id: booking.propertyId,
      listing_title: booking.listingTitle,
      city: booking.city,
    },
    payment: booking.payment
      ? {
          id: booking.payment.id,
          provider: booking.payment.provider,
          status: booking.payment.status,
          provider_reference: booking.payment.provider_reference,
          amount_total_minor: booking.payment.amount_total_minor,
          currency: booking.payment.currency,
          updated_at: booking.payment.updated_at,
        }
      : null,
  });
}

export async function GET(request: NextRequest) {
  return getShortletPaymentStatusResponse(request);
}
