import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  createShortletBookingViaRpc,
  ensureShortletPayoutForBooking,
  mapLegacyListingIntent,
} from "@/lib/shortlet/shortlet.server";
import {
  notifyGuestBookingConfirmed,
  notifyGuestBookingPending,
  notifyHostBookingRequest,
} from "@/lib/shortlet/notifications.server";

const routeLabel = "/api/shortlet/bookings/create";

const payloadSchema = z.object({
  property_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function resolveHostEmail(hostUserId: string): Promise<string | null> {
  if (!hasServiceRoleEnv()) return null;
  try {
    const client = createServiceRoleClient();
    const { data } = await client.auth.admin.getUserById(hostUserId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant", "agent", "landlord", "admin"],
  });
  if (!auth.ok) return auth.response;

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const { property_id, check_in, check_out } = parsed.data;

  try {
    const supabase = await createServerSupabaseClient();
    const { data: propertyData, error: propertyError } = await supabase
      .from("properties")
      .select("id,owner_id,title,city,currency,listing_intent")
      .eq("id", property_id)
      .maybeSingle();

    if (propertyError || !propertyData) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const listingIntent = mapLegacyListingIntent(propertyData.listing_intent);
    if (listingIntent !== "shortlet") {
      return NextResponse.json({ error: "This listing is not bookable as a shortlet." }, { status: 409 });
    }

    const created = await createShortletBookingViaRpc({
      client: supabase,
      propertyId: property_id,
      guestUserId: auth.user.id,
      checkIn: check_in,
      checkOut: check_out,
    });

    if (created.status === "confirmed" && hasServiceRoleEnv()) {
      const adminClient = createServiceRoleClient();
      await ensureShortletPayoutForBooking({
        client: adminClient,
        bookingId: created.bookingId,
        hostUserId: propertyData.owner_id,
        amountMinor: created.totalAmountMinor,
        currency: created.currency || propertyData.currency || "NGN",
      });
    }

    const notificationPayload = {
      propertyTitle: propertyData.title || "Shortlet listing",
      city: propertyData.city,
      checkIn: check_in,
      checkOut: check_out,
      nights: created.nights,
      amountMinor: created.totalAmountMinor,
      currency: created.currency || propertyData.currency || "NGN",
      bookingId: created.bookingId,
    };

    const hostEmail = await resolveHostEmail(propertyData.owner_id);

    if (created.status === "confirmed") {
      await Promise.all([
        notifyGuestBookingConfirmed(auth.user.email ?? null, notificationPayload),
        notifyHostBookingRequest(hostEmail, notificationPayload),
      ]);
    } else {
      await Promise.all([
        notifyGuestBookingPending(auth.user.email ?? null, notificationPayload),
        notifyHostBookingRequest(hostEmail, notificationPayload),
      ]);
    }

    return NextResponse.json({
      ok: true,
      booking: {
        id: created.bookingId,
        status: created.status,
        nights: created.nights,
        total_amount_minor: created.totalAmountMinor,
        currency: created.currency,
        expires_at: created.expiresAt,
        pricing_snapshot: created.pricingSnapshot,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create booking";
    const status =
      message.includes("DATES_") ||
      message.includes("NIGHTS") ||
      message.includes("NOTICE") ||
      message.includes("SHORTLET")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
