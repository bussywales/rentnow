import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { canViewTenantShortletBookings } from "@/lib/shortlet/access";
import {
  getGuestShortletBookingById,
  type GuestShortletBookingDetail,
} from "@/lib/shortlet/shortlet.server";

const routeLabel = "/api/shortlet/bookings/[id]/mine";

export type ShortletMineBookingDetailDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireRole: typeof requireRole;
  getGuestShortletBookingById: typeof getGuestShortletBookingById;
};

const defaultDeps: ShortletMineBookingDetailDeps = {
  hasServerSupabaseEnv,
  requireRole,
  getGuestShortletBookingById,
};

export async function getShortletMineBookingDetailResponse(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: ShortletMineBookingDetailDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant", "landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  if (!canViewTenantShortletBookings(auth.role)) {
    return NextResponse.json({ error: "Tenant-only endpoint." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Booking id required" }, { status: 422 });
  }

  let booking: GuestShortletBookingDetail | null = null;
  try {
    booking = await deps.getGuestShortletBookingById({
      client: auth.supabase,
      guestUserId: auth.user.id,
      bookingId: id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load booking";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, booking });
}

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return getShortletMineBookingDetailResponse(request, context);
}
