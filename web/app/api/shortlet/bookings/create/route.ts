import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  createShortletBookingViaRpc,
  getShortletSettingsForProperty,
} from "@/lib/shortlet/shortlet.server";
import { mapBookingCreateError } from "@/lib/shortlet/bookings";
import { isShortletProperty } from "@/lib/shortlet/discovery";
import {
  getShortletPaymentsProviderFlags,
  resolveShortletPaymentProviderDecision,
} from "@/lib/shortlet/payments.server";

const routeLabel = "/api/shortlet/bookings/create";

const payloadSchema = z.object({
  property_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).passthrough();

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

  const rawPayload = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const { property_id, check_in, check_out } = parsed.data;
  const payloadRecord =
    rawPayload && typeof rawPayload === "object" ? (rawPayload as Record<string, unknown>) : {};
  console.info("[shortlet-bookings/create] start", {
    propertyId: property_id,
    checkIn: check_in,
    checkOut: check_out,
    nights:
      typeof payloadRecord.nights === "number" && Number.isFinite(payloadRecord.nights)
        ? payloadRecord.nights
        : null,
    guests:
      typeof payloadRecord.guests === "number" && Number.isFinite(payloadRecord.guests)
        ? payloadRecord.guests
        : null,
    intent: typeof payloadRecord.intent === "string" ? payloadRecord.intent : null,
    mode:
      typeof payloadRecord.mode === "string"
        ? payloadRecord.mode
        : typeof payloadRecord.booking_mode === "string"
          ? payloadRecord.booking_mode
          : null,
  });

  try {
    const supabase = await createServerSupabaseClient();
    const { data: propertyData, error: propertyError } = await supabase
      .from("properties")
      .select("id,currency,country,country_code,listing_intent,rental_type")
      .eq("id", property_id)
      .maybeSingle();

    if (propertyError || !propertyData) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const settings = await getShortletSettingsForProperty(supabase, property_id);
    const isShortletListing = isShortletProperty({
      listing_intent: propertyData.listing_intent,
      rental_type: propertyData.rental_type,
      shortlet_settings: settings ? [settings] : [],
    });
    if (!isShortletListing) {
      return NextResponse.json({ error: "This listing is not bookable as a shortlet." }, { status: 409 });
    }

    let created = await createShortletBookingViaRpc({
      client: supabase,
      propertyId: property_id,
      guestUserId: auth.user.id,
      checkIn: check_in,
      checkOut: check_out,
    });

    if (created.status !== "pending_payment") {
      const { data: updated } = await supabase
        .from("shortlet_bookings")
        .update({
          status: "pending_payment",
          expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", created.bookingId)
        .in("status", ["pending", "confirmed"])
        .select("status")
        .maybeSingle();
      if (updated?.status === "pending_payment") {
        created = {
          ...created,
          status: "pending_payment",
          expiresAt: null,
        };
      } else {
        throw new Error("Unable to prepare booking for payment.");
      }
    }

    const providerFlags = await getShortletPaymentsProviderFlags();
    const providerDecision = resolveShortletPaymentProviderDecision({
      propertyCountry:
        typeof propertyData.country_code === "string" && propertyData.country_code.trim().length > 0
          ? propertyData.country_code
          : typeof propertyData.country === "string"
            ? propertyData.country
            : null,
      bookingCurrency: created.currency || propertyData.currency || "NGN",
      stripeEnabled: providerFlags.stripeEnabled,
      paystackEnabled: providerFlags.paystackEnabled,
    });
    console.info("[shortlet-bookings/create] payment decision", {
      propertyCountry: providerDecision.propertyCountry,
      bookingCurrency: providerDecision.bookingCurrency,
      marketCountry:
        typeof propertyData.country_code === "string" && propertyData.country_code.trim().length > 0
          ? propertyData.country_code
          : null,
      stripeEnabled: providerDecision.stripeEnabled,
      paystackEnabled: providerDecision.paystackEnabled,
      chosenProvider: providerDecision.chosenProvider,
    });

    if (!providerDecision.chosenProvider) {
      return NextResponse.json(
        {
          error: "Payments are not available for this listing right now.",
          code: "PAYMENTS_PROVIDER_UNAVAILABLE",
        },
        { status: 400 }
      );
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
      payment_required: true,
      chosen_provider: providerDecision.chosenProvider,
    });
  } catch (error) {
    const err = error as {
      message?: string;
      name?: string;
      code?: string;
      status?: number;
      stack?: string;
    };
    console.error("[shortlet-bookings/create] failed", {
      message: typeof err?.message === "string" ? err.message : null,
      name: typeof err?.name === "string" ? err.name : null,
      code: typeof err?.code === "string" ? err.code : null,
      status: typeof err?.status === "number" ? err.status : null,
      stack: typeof err?.stack === "string" ? err.stack : null,
    });
    const message = error instanceof Error ? error.message : "Unable to create booking";
    const mapped = mapBookingCreateError(message);
    return NextResponse.json(
      {
        error: mapped.error,
        code: typeof err?.code === "string" ? err.code : "BOOKING_PAYMENT_PREP_FAILED",
      },
      { status: mapped.status }
    );
  }
}
