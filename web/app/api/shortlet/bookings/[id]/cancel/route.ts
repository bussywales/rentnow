import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { cancelShortletBooking } from "@/lib/shortlet/shortlet.server";

const routeLabel = "/api/shortlet/bookings/[id]/cancel";
const payloadSchema = z.object({
  reason: z.string().trim().max(280).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant", "landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Booking id required" }, { status: 422 });
  const parsed = payloadSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cancel payload" }, { status: 422 });
  }
  const reason = parsed.data.reason?.trim();

  try {
    const supabase = await createServerSupabaseClient();
    const { data: booking } = await supabase
      .from("shortlet_bookings")
      .select("id,guest_user_id,host_user_id,pricing_snapshot_json")
      .eq("id", id)
      .maybeSingle();
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    let canCancel =
      auth.role === "admin" ||
      auth.user.id === String(booking.guest_user_id || "") ||
      auth.user.id === String(booking.host_user_id || "");

    if (!canCancel && auth.role === "agent") {
      canCancel = await hasActiveDelegation(
        supabase,
        auth.user.id,
        String(booking.host_user_id || "")
      );
    }
    if (!canCancel) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = createServiceRoleClient();
    const cancelled = await cancelShortletBooking({
      client: db,
      bookingId: id,
      actorUserId: auth.user.id,
      isAdmin: auth.role === "admin",
    });

    if (reason) {
      const previousSnapshot =
        booking.pricing_snapshot_json &&
        typeof booking.pricing_snapshot_json === "object"
          ? (booking.pricing_snapshot_json as Record<string, unknown>)
          : {};
      const untypedDb = db as unknown as {
        from: (table: string) => {
          update: (values: Record<string, unknown>) => {
            eq: (column: string, value: string) => Promise<{ error?: { message?: string } | null }>;
          };
        };
      };
      await untypedDb
        .from("shortlet_bookings")
        .update({
          pricing_snapshot_json: {
            ...previousSnapshot,
            cancel_reason: reason,
            cancelled_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    return NextResponse.json({
      ok: true,
      booking: {
        id: cancelled.bookingId,
        status: cancelled.status,
        property_id: cancelled.propertyId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to cancel booking";
    const status =
      message.includes("INVALID_STATUS") || message.includes("FORBIDDEN") || message.includes("BOOKING_NOT_FOUND")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
