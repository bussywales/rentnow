import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  getShortletSettingsForProperty,
  listBlockedRangesForProperty,
} from "@/lib/shortlet/shortlet.server";
import { isShortletProperty } from "@/lib/shortlet/discovery";

type PropertyAvailabilityRow = {
  id: string;
  listing_intent: string | null;
  rental_type: string | null;
  timezone?: string | null;
};

const routeLabel = "/api/shortlet/availability";

function parseDate(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return toDateKey(utc);
}

async function loadPropertyRow(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, listingId: string) {
  const primary = await supabase
    .from("properties")
    .select("id,listing_intent,rental_type,timezone")
    .eq("id", listingId)
    .maybeSingle();

  if (
    primary.error &&
    primary.error.message.toLowerCase().includes("timezone") &&
    primary.error.message.toLowerCase().includes("does not exist")
  ) {
    const fallback = await supabase
      .from("properties")
      .select("id,listing_intent,rental_type")
      .eq("id", listingId)
      .maybeSingle();
    return {
      data: fallback.data as PropertyAvailabilityRow | null,
      error: fallback.error,
    };
  }

  return {
    data: primary.data as PropertyAvailabilityRow | null,
    error: primary.error,
  };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const listingId =
    request.nextUrl.searchParams.get("listingId") || request.nextUrl.searchParams.get("propertyId");
  if (!listingId) {
    return NextResponse.json({ error: "listingId is required" }, { status: 400 });
  }

  const fromParam = parseDate(request.nextUrl.searchParams.get("from"));
  const toParam = parseDate(request.nextUrl.searchParams.get("to"));
  const today = toDateKey(new Date());
  const from = fromParam ?? today;
  const to = toParam ?? addDays(from, 180);

  if (from >= to) {
    return NextResponse.json({ error: "Invalid availability window" }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: propertyData, error: propertyError } = await loadPropertyRow(supabase, listingId);

    if (propertyError || !propertyData) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const settings = await getShortletSettingsForProperty(supabase, listingId);
    const isShortletListing = isShortletProperty({
      listing_intent: propertyData.listing_intent,
      rental_type: propertyData.rental_type,
      shortlet_settings: settings ? [settings] : [],
    });

    if (!isShortletListing) {
      return NextResponse.json({
        ok: true,
        route: routeLabel,
        listingId,
        from,
        to,
        blockedRanges: [],
        bookedRanges: [],
        timezone: typeof propertyData.timezone === "string" ? propertyData.timezone : null,
      });
    }

    const blocked = await listBlockedRangesForProperty({
      client: supabase,
      propertyId: listingId,
      from,
      to,
    });

    return NextResponse.json({
      ok: true,
      route: routeLabel,
      listingId,
      from,
      to,
      blockedRanges: blocked.blocks.map((row) => ({
        start: row.from,
        end: row.to,
        source:
          typeof row.reason === "string" && row.reason.trim().length > 0
            ? row.reason.toLowerCase().includes("maint")
              ? "maintenance"
              : "host_block"
            : "host_block",
      })),
      bookedRanges: blocked.bookings.map((row) => ({
        start: row.from,
        end: row.to,
        bookingId: row.id,
      })),
      timezone: typeof propertyData.timezone === "string" ? propertyData.timezone : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load shortlet availability",
      },
      { status: 500 }
    );
  }
}
