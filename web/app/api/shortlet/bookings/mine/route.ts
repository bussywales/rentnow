import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { listGuestShortletBookings } from "@/lib/shortlet/shortlet.server";
import { canViewTenantShortletBookings } from "@/lib/shortlet/access";

const routeLabel = "/api/shortlet/bookings/mine";

export type ShortletMineBookingsDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireRole: typeof requireRole;
  listGuestShortletBookings: typeof listGuestShortletBookings;
};

const defaultDeps: ShortletMineBookingsDeps = {
  hasServerSupabaseEnv,
  requireRole,
  listGuestShortletBookings,
};

export async function getShortletMineBookingsResponse(
  request: NextRequest,
  deps: ShortletMineBookingsDeps = defaultDeps
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

  try {
    const rows = await deps.listGuestShortletBookings({
      client: auth.supabase,
      guestUserId: auth.user.id,
      limit: 100,
    });
    return NextResponse.json({ ok: true, bookings: rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load shortlet bookings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return getShortletMineBookingsResponse(request);
}
