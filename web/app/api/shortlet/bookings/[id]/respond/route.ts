import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { requireRole } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  ensureShortletPayoutForBooking,
  respondShortletBookingViaRpc,
} from "@/lib/shortlet/shortlet.server";
import {
  notifyHostBookingApprovedConfirmation,
  notifyTenantBookingApproved,
  notifyTenantBookingDeclined,
} from "@/lib/shortlet/notifications.server";
import {
  buildShortletNotificationBody,
  createNotification,
} from "@/lib/notifications/notifications.server";

const routeLabel = "/api/shortlet/bookings/[id]/respond";

const payloadSchema = z.object({
  action: z.enum(["accept", "decline"]),
  reason: z.string().trim().max(280).optional(),
});

async function resolveUserEmail(userId: string): Promise<string | null> {
  if (!hasServiceRoleEnv()) return null;
  try {
    const client = createServiceRoleClient();
    const { data } = await client.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: bookingData, error: bookingError } = await supabase
      .from("shortlet_bookings")
      .select(
        "id,property_id,host_user_id,guest_user_id,status,check_in,check_out,nights,total_amount_minor,currency,pricing_snapshot_json,properties!inner(id,title,city,owner_id)"
      )
      .eq("id", id)
      .maybeSingle();

    if (bookingError || !bookingData) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const bookingRow = bookingData as Record<string, unknown>;
    const propertyRelation = bookingRow.properties as
      | Record<string, unknown>
      | Array<Record<string, unknown>>
      | null
      | undefined;
    const property = Array.isArray(propertyRelation)
      ? (propertyRelation[0] ?? null)
      : propertyRelation ?? null;
    const booking = {
      id: String(bookingRow.id || ""),
      property_id: String(bookingRow.property_id || ""),
      host_user_id: String(bookingRow.host_user_id || ""),
      guest_user_id: String(bookingRow.guest_user_id || ""),
      status: String(bookingRow.status || "pending"),
      check_in: String(bookingRow.check_in || ""),
      check_out: String(bookingRow.check_out || ""),
      nights: Number(bookingRow.nights || 0),
      total_amount_minor: Number(bookingRow.total_amount_minor || 0),
      currency: String(bookingRow.currency || "NGN"),
      pricing_snapshot_json:
        bookingRow.pricing_snapshot_json &&
        typeof bookingRow.pricing_snapshot_json === "object"
          ? (bookingRow.pricing_snapshot_json as Record<string, unknown>)
          : {},
      properties: property
        ? {
            id: String(property.id || ""),
            title: typeof property.title === "string" ? property.title : null,
            city: typeof property.city === "string" ? property.city : null,
            owner_id: typeof property.owner_id === "string" ? property.owner_id : null,
          }
        : null,
    };

    let canRespond = auth.role === "admin" || auth.user.id === booking.host_user_id;
    if (!canRespond && auth.role === "agent") {
      canRespond = await hasActiveDelegation(supabase, auth.user.id, booking.host_user_id);
    }
    if (!canRespond) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const hostUserId = booking.host_user_id;

    const updated = await respondShortletBookingViaRpc({
      client: supabase,
      bookingId: booking.id,
      hostUserId,
      action: parsed.data.action,
    });

    const reason = parsed.data.reason?.trim();
    if (reason && parsed.data.action === "decline") {
      const nextSnapshot = {
        ...(booking.pricing_snapshot_json || {}),
        host_decision_reason: reason,
        host_decision_at: new Date().toISOString(),
      };
      await supabase
        .from("shortlet_bookings")
        .update({
          pricing_snapshot_json: nextSnapshot,
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id);
    }

    if (updated.status === "confirmed" && hasServiceRoleEnv()) {
      const adminClient = createServiceRoleClient();
      await ensureShortletPayoutForBooking({
        client: adminClient,
        bookingId: booking.id,
        hostUserId,
        amountMinor: booking.total_amount_minor,
        currency: booking.currency,
      });
    }

    const [guestEmail, hostEmail] = await Promise.all([
      resolveUserEmail(booking.guest_user_id),
      resolveUserEmail(booking.host_user_id),
    ]);
    const notificationPayload = {
      propertyTitle: booking.properties?.title || "Shortlet listing",
      city: booking.properties?.city || null,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      amountMinor: booking.total_amount_minor,
      currency: booking.currency,
      bookingId: booking.id,
    };
    const notificationBody = buildShortletNotificationBody({
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      amountMinor: booking.total_amount_minor,
      currency: booking.currency,
    });

    if (parsed.data.action === "accept") {
      await Promise.all([
        notifyTenantBookingApproved({
          guestUserId: booking.guest_user_id,
          email: guestEmail,
          payload: notificationPayload,
        }),
        notifyHostBookingApprovedConfirmation({
          hostUserId: booking.host_user_id,
          email: hostEmail,
          payload: notificationPayload,
        }),
        createNotification({
          userId: booking.guest_user_id,
          type: "shortlet_booking_approved",
          title: `Booking approved: ${booking.properties?.title || "Shortlet listing"}`,
          body: notificationBody,
          href: `/trips/${booking.id}`,
          dedupeKey: `shortlet_booking:${booking.id}:approved:tenant`,
        }),
        createNotification({
          userId: booking.host_user_id,
          type: "shortlet_booking_host_update",
          title: "You approved a booking request",
          body: notificationBody,
          href: "/host?tab=bookings#host-bookings",
          dedupeKey: `shortlet_booking:${booking.id}:approved:host`,
        }),
      ]);
    } else {
      await Promise.all([
        notifyTenantBookingDeclined({
          guestUserId: booking.guest_user_id,
          email: guestEmail,
          payload: notificationPayload,
        }),
        createNotification({
          userId: booking.guest_user_id,
          type: "shortlet_booking_declined",
          title: `Booking declined: ${booking.properties?.title || "Shortlet listing"}`,
          body: notificationBody,
          href: `/trips/${booking.id}`,
          dedupeKey: `shortlet_booking:${booking.id}:declined:tenant`,
        }),
      ]);
    }

    return NextResponse.json({
      ok: true,
      booking: {
        id: updated.bookingId,
        status: updated.status,
        property_id: updated.propertyId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update booking";
    const status = message.includes("INVALID_STATUS") || message.includes("FORBIDDEN") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
