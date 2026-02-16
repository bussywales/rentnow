import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { expireDueShortletBookings } from "@/lib/shortlet/shortlet.server";
import { notifyTenantBookingExpired } from "@/lib/shortlet/notifications.server";

const routeLabel = "/api/shortlet/bookings/expire-due";

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

function hasValidSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || "";
  if (!expected) return false;
  return request.headers.get("x-cron-secret") === expected;
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ ok: false, error: "Service role missing" }, { status: 503 });
  }
  if (!hasValidSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = createServiceRoleClient();
    const expired = await expireDueShortletBookings(client);

    for (const row of expired) {
      const bookingId = String(row.id || "");
      const guestUserId = String(row.guest_user_id || "");
      const propertyId = String(row.property_id || "");
      if (!bookingId || !guestUserId) continue;

      const { data: bookingData } = await client
        .from("shortlet_bookings")
        .select("check_in,check_out,nights,total_amount_minor,currency,properties!inner(title,city)")
        .eq("id", bookingId)
        .maybeSingle();

      const booking = (bookingData as {
        check_in?: string;
        check_out?: string;
        nights?: number;
        total_amount_minor?: number;
        currency?: string;
        properties?: { title?: string | null; city?: string | null } | null;
      } | null) ?? null;

      const guestEmail = await resolveUserEmail(guestUserId);
      await notifyTenantBookingExpired({
        guestUserId,
        email: guestEmail,
        payload: {
          propertyTitle: booking?.properties?.title || `Listing ${propertyId}`,
          city: booking?.properties?.city || null,
          checkIn: booking?.check_in || "",
          checkOut: booking?.check_out || "",
          nights: Number(booking?.nights || 0),
          amountMinor: Number(booking?.total_amount_minor || 0),
          currency: booking?.currency || "NGN",
          bookingId,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      route: routeLabel,
      expired: expired.length,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to expire bookings" },
      { status: 500 }
    );
  }
}
