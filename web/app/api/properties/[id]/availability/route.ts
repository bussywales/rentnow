import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { calculateShortletPricing } from "@/lib/shortlet/pricing";
import { getShortletSettingsForProperty, listBlockedRangesForProperty, mapLegacyListingIntent } from "@/lib/shortlet/shortlet.server";

const routeLabel = "/api/properties/[id]/availability";

function parseDate(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  const from = parseDate(request.nextUrl.searchParams.get("from"));
  const to = parseDate(request.nextUrl.searchParams.get("to"));

  try {
    const supabase = await createServerSupabaseClient();
    const { data: propertyData, error: propertyError } = await supabase
      .from("properties")
      .select("id,listing_intent,currency")
      .eq("id", id)
      .maybeSingle();

    if (propertyError || !propertyData) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const intent = mapLegacyListingIntent(propertyData.listing_intent);
    if (intent !== "shortlet") {
      return NextResponse.json({
        propertyId: id,
        listingIntent: intent,
        blockedRanges: [],
        bookingMode: null,
        pricing: null,
      });
    }

    const [settings, blocked] = await Promise.all([
      getShortletSettingsForProperty(supabase, id),
      listBlockedRangesForProperty({
        client: supabase,
        propertyId: id,
        from,
        to,
      }),
    ]);

    let pricing: Record<string, unknown> | null = null;
    if (from && to) {
      const nightlyPriceMinor =
        typeof settings?.nightly_price_minor === "number" ? settings.nightly_price_minor : null;
      try {
        if (nightlyPriceMinor && nightlyPriceMinor > 0) {
          const breakdown = calculateShortletPricing({
            checkIn: from,
            checkOut: to,
            nightlyPriceMinor,
            cleaningFeeMinor: settings?.cleaning_fee_minor ?? 0,
            depositMinor: settings?.deposit_minor ?? 0,
          });
          pricing = {
            ...breakdown,
            currency: propertyData.currency || "NGN",
            minNights: settings?.min_nights ?? 1,
            maxNights: settings?.max_nights ?? null,
          };
        } else {
          pricing = null;
        }
      } catch {
        pricing = null;
      }
    }

    return NextResponse.json({
      route: routeLabel,
      propertyId: id,
      listingIntent: intent,
      bookingMode: settings?.booking_mode ?? "request",
      blockedRanges: [...blocked.bookings, ...blocked.blocks],
      settings: settings
        ? {
            minNights: settings.min_nights,
            maxNights: settings.max_nights,
            advanceNoticeHours: settings.advance_notice_hours,
            prepDays: settings.prep_days,
            checkinTime: settings.checkin_time,
            checkoutTime: settings.checkout_time,
            nightlyPriceMinor: settings.nightly_price_minor,
            cleaningFeeMinor: settings.cleaning_fee_minor,
            depositMinor: settings.deposit_minor,
          }
        : null,
      pricing,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load availability",
      },
      { status: 500 }
    );
  }
}
