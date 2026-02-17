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
  type ShortletPaymentProviderUnavailableReason,
  resolveShortletPaymentProviderDecision,
} from "@/lib/shortlet/payments.server";

const routeLabel = "/api/shortlet/bookings/create";
const providerUnavailableErrorCode = "SHORTLET_PAYMENT_PROVIDER_UNAVAILABLE";

type CreateRouteError = {
  message?: string;
  name?: string;
  code?: string;
  status?: number;
  reason?: string;
  stack?: string;
};

class ShortletPaymentProviderUnavailableError extends Error {
  code = providerUnavailableErrorCode;
  status = 409;
  reason: string;

  constructor(reason: ShortletPaymentProviderUnavailableReason) {
    super("Payments are not available for this listing right now.");
    this.name = "ShortletPaymentProviderUnavailableError";
    this.reason = reason;
  }
}

export function buildProviderUnavailableResponse(reason: string) {
  return NextResponse.json(
    {
      error: providerUnavailableErrorCode,
      reason,
    },
    { status: 409 }
  );
}

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
        console.info("[shortlet-bookings/create] prepare-payment", {
          bookingId: created.bookingId,
          propertyId: property_id,
          propertyCountry:
            typeof propertyData.country_code === "string" && propertyData.country_code.trim().length > 0
              ? propertyData.country_code
              : typeof propertyData.country === "string"
                ? propertyData.country
                : null,
          propertyCurrency: typeof propertyData.currency === "string" ? propertyData.currency : null,
          bookingCurrency: typeof created.currency === "string" ? created.currency : null,
          stripeEnabled: null,
          paystackEnabled: null,
          chosenProvider: null,
          reason: "booking_status_transition_failed",
        });
        const prepareError = new Error("Unable to prepare booking for payment.") as CreateRouteError &
          Error;
        prepareError.code = "BOOKING_PAYMENT_PREP_FAILED";
        prepareError.status = 409;
        prepareError.reason = "booking_status_transition_failed";
        throw prepareError;
      }
    }

    const providerFlags = await getShortletPaymentsProviderFlags();
    const propertyCountry =
      typeof propertyData.country_code === "string" && propertyData.country_code.trim().length > 0
        ? propertyData.country_code
        : typeof propertyData.country === "string"
          ? propertyData.country
          : null;
    const propertyCurrency = typeof propertyData.currency === "string" ? propertyData.currency : null;
    const providerDecision = resolveShortletPaymentProviderDecision({
      propertyCountry,
      bookingCurrency: created.currency || propertyCurrency,
      stripeEnabled: providerFlags.stripeEnabled,
      paystackEnabled: providerFlags.paystackEnabled,
    });
    console.info("[shortlet-bookings/create] payment decision", {
      propertyCountry: providerDecision.propertyCountry,
      propertyCurrency,
      bookingCurrency: providerDecision.bookingCurrency,
      marketCountry: propertyCountry,
      stripeEnabled: providerDecision.stripeEnabled,
      paystackEnabled: providerDecision.paystackEnabled,
      chosenProvider: providerDecision.chosenProvider,
    });

    if (!providerDecision.chosenProvider) {
      const reason = providerDecision.reason || "both_providers_disabled";
      console.info("[shortlet-bookings/create] prepare-payment", {
        bookingId: created.bookingId,
        propertyId: property_id,
        propertyCountry: providerDecision.propertyCountry,
        propertyCurrency,
        bookingCurrency: providerDecision.bookingCurrency || null,
        stripeEnabled: providerDecision.stripeEnabled,
        paystackEnabled: providerDecision.paystackEnabled,
        chosenProvider: providerDecision.chosenProvider,
        reason,
      });
      throw new ShortletPaymentProviderUnavailableError(reason);
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
    const err = error as CreateRouteError;
    console.error("[shortlet-bookings/create] failed", {
      message: typeof err?.message === "string" ? err.message : null,
      name: typeof err?.name === "string" ? err.name : null,
      code: typeof err?.code === "string" ? err.code : null,
      status: typeof err?.status === "number" ? err.status : null,
      reason: typeof err?.reason === "string" ? err.reason : null,
      stack: typeof err?.stack === "string" ? err.stack : null,
    });
    if (err?.code === providerUnavailableErrorCode) {
      return buildProviderUnavailableResponse(
        typeof err.reason === "string" ? err.reason : "both_providers_disabled"
      );
    }
    const message = error instanceof Error ? error.message : "Unable to create booking";
    const mapped = mapBookingCreateError(message);
    return NextResponse.json(
      {
        error: mapped.error,
        code: typeof err?.code === "string" ? err.code : "BOOKING_PAYMENT_PREP_FAILED",
        reason: typeof err?.reason === "string" ? err.reason : null,
      },
      { status: mapped.status }
    );
  }
}
