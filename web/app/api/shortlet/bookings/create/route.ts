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
const invalidDatesErrorCode = "SHORTLET_INVALID_DATES";
const invalidGuestsErrorCode = "SHORTLET_INVALID_GUESTS";
const invalidPayloadErrorCode = "SHORTLET_INVALID_PAYLOAD";

type CreateRouteError = {
  message?: string;
  name?: string;
  code?: string;
  status?: number;
  reason?: string;
  details?: unknown;
  hint?: unknown;
  response?: unknown;
  body?: unknown;
  data?: unknown;
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

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function calculateBookingNightsFromDates(checkIn: string, checkOut: string): number | null {
  const start = parseIsoDate(checkIn);
  const end = parseIsoDate(checkOut);
  if (!start || !end) return null;
  const diff = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  if (!Number.isFinite(diff) || diff < 1 || !Number.isInteger(diff)) return null;
  return diff;
}

export function resolveBookingGuests(value: unknown): number | null {
  if (value == null || value === "") return 1;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) return null;
  if (numeric < 1 || numeric > 50) return null;
  return numeric;
}

export function resolveBookingMode(
  payloadMode: unknown,
  settingsMode: unknown
): "instant" | "request" {
  if (payloadMode === "instant" || payloadMode === "request") return payloadMode;
  if (settingsMode === "instant" || settingsMode === "request") return settingsMode;
  return "request";
}

function getPropertyCountryCode(property: {
  country?: string | null;
  country_code?: string | null;
}) {
  if (typeof property.country_code === "string" && property.country_code.trim().length > 0) {
    return property.country_code;
  }
  if (typeof property.country === "string" && property.country.trim().length > 0) {
    return property.country;
  }
  return null;
}

function safeSerialize(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 2000);
  try {
    return JSON.stringify(value).slice(0, 2000);
  } catch {
    return String(value).slice(0, 2000);
  }
}

async function readUpstreamResponseBody(err: CreateRouteError): Promise<string | null> {
  const explicit =
    safeSerialize(err.body) ||
    safeSerialize(err.data) ||
    safeSerialize(err.details);
  if (explicit) return explicit;

  const responseLike = err.response as
    | {
        clone?: () => { text: () => Promise<string> };
        text?: () => Promise<string>;
        json?: () => Promise<unknown>;
      }
    | undefined;

  if (!responseLike || typeof responseLike !== "object") return null;

  try {
    if (typeof responseLike.clone === "function") {
      const text = await responseLike.clone().text();
      return safeSerialize(text);
    }
    if (typeof responseLike.text === "function") {
      const text = await responseLike.text();
      return safeSerialize(text);
    }
    if (typeof responseLike.json === "function") {
      const json = await responseLike.json();
      return safeSerialize(json);
    }
  } catch {
    return null;
  }

  return null;
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
    const invalidDateField = parsed.error.issues.some(
      (issue) => issue.path[0] === "check_in" || issue.path[0] === "check_out"
    );
    if (invalidDateField) {
      return NextResponse.json(
        { error: "Invalid booking dates.", code: invalidDatesErrorCode },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid payload", code: invalidPayloadErrorCode }, { status: 400 });
  }

  const { property_id, check_in, check_out } = parsed.data;
  let derivedNights: number | null = null;
  let derivedGuests: number | null = null;
  let derivedMode: "instant" | "request" | null = null;
  let debugTransition: { from: string | null; to: string | null } = {
    from: null,
    to: "pending_payment",
  };
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

    derivedNights = calculateBookingNightsFromDates(check_in, check_out);
    if (!derivedNights) {
      return NextResponse.json(
        { error: "Invalid booking dates.", code: invalidDatesErrorCode },
        { status: 400 }
      );
    }
    derivedGuests = resolveBookingGuests(payloadRecord.guests);
    if (!derivedGuests) {
      return NextResponse.json(
        { error: "Invalid guests value.", code: invalidGuestsErrorCode },
        { status: 400 }
      );
    }
    derivedMode = resolveBookingMode(payloadRecord.mode ?? payloadRecord.booking_mode, settings?.booking_mode);
    const propertyCountry = getPropertyCountryCode(propertyData);
    const propertyCurrency = typeof propertyData.currency === "string" ? propertyData.currency : null;
    const bookingCurrency = propertyCurrency || "NGN";
    const intent = typeof payloadRecord.intent === "string" ? payloadRecord.intent : "shortlet";

    console.log("[shortlet-bookings/create] derived-inputs", {
      nights: derivedNights,
      guests: derivedGuests,
      mode: derivedMode,
      propertyCountry,
      bookingCurrency,
    });
    console.info("[shortlet-bookings/create] derived-inputs-meta", {
      propertyId: property_id,
      intent,
      checkIn: check_in,
      checkOut: check_out,
    });

    let created: Awaited<ReturnType<typeof createShortletBookingViaRpc>>;
    try {
      created = await createShortletBookingViaRpc({
        client: supabase,
        propertyId: property_id,
        guestUserId: auth.user.id,
        checkIn: check_in,
        checkOut: check_out,
      });
    } catch (rpcError) {
      const rpcErr = rpcError as CreateRouteError;
      console.error(`[shortlet-bookings/create] ${routeLabel} booking-create-rpc-failed`, {
        route: routeLabel,
        propertyId: property_id,
        currentStatus: null,
        targetStatus: "pending_payment",
        supabaseError: {
          message: typeof rpcErr?.message === "string" ? rpcErr.message : null,
          details: rpcErr?.details ?? null,
          hint: rpcErr?.hint ?? null,
          code: typeof rpcErr?.code === "string" ? rpcErr.code : null,
          status: typeof rpcErr?.status === "number" ? rpcErr.status : null,
        },
      });
      throw rpcError;
    }

    debugTransition = {
      from: created.status,
      to: "pending_payment",
    };
    console.info("[shortlet-bookings/create] status-check", {
      route: routeLabel,
      bookingId: created.bookingId,
      currentStatus: created.status,
      targetStatus: "pending_payment",
    });

    if (created.status !== "pending_payment") {
      console.error(`[shortlet-bookings/create] ${routeLabel} unexpected booking status`, {
        route: routeLabel,
        bookingId: created.bookingId,
        propertyId: property_id,
        currentStatus: created.status,
        targetStatus: "pending_payment",
        supabaseError: {
          message: null,
          details: null,
          hint: null,
          code: null,
          status: null,
        },
      });
      const prepareError = new Error("Unable to prepare booking for payment.") as CreateRouteError &
        Error;
      prepareError.code = "BOOKING_PAYMENT_PREP_FAILED";
      prepareError.status = 409;
      prepareError.reason = "booking_initial_status_invalid";
      throw prepareError;
    }

    const providerFlags = await getShortletPaymentsProviderFlags();
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
    const upstreamBody = await readUpstreamResponseBody(err);
    console.error(`[shortlet-bookings/create] ${routeLabel} failed`, {
      route: routeLabel,
      message: typeof err?.message === "string" ? err.message : null,
      name: typeof err?.name === "string" ? err.name : null,
      code: typeof err?.code === "string" ? err.code : null,
      status: typeof err?.status === "number" ? err.status : null,
      reason: typeof err?.reason === "string" ? err.reason : null,
      details: err?.details ?? null,
      hint: err?.hint ?? null,
      upstreamBody,
      stack: typeof err?.stack === "string" ? err.stack : null,
    });
    if (err?.code === providerUnavailableErrorCode) {
      return buildProviderUnavailableResponse(
        typeof err.reason === "string" ? err.reason : "both_providers_disabled"
      );
    }
    const message = error instanceof Error ? error.message : "Unable to create booking";
    const mapped = mapBookingCreateError(message);
    const responseCode = typeof err?.code === "string" ? err.code : "BOOKING_PAYMENT_PREP_FAILED";
    const responseReason = typeof err?.reason === "string" ? err.reason : null;
    if (mapped.status >= 500) {
      const debug = {
        upstream: {
          message: typeof err?.message === "string" ? err.message : null,
          details: err?.details ?? null,
          hint: err?.hint ?? null,
          code: typeof err?.code === "string" ? err.code : null,
          status: typeof err?.status === "number" ? err.status : null,
          upstreamBody,
        },
        transition: debugTransition,
      };
      console.error(
        "[shortlet-bookings/create] 500",
        JSON.stringify(
          {
            code: responseCode,
            reason: responseReason,
            propertyId: property_id,
            checkIn: check_in,
            checkOut: check_out,
            nights: derivedNights,
            guests: derivedGuests,
            mode: derivedMode,
            debug,
          },
          null,
          2
        )
      );
    }
    return NextResponse.json(
      {
        error: mapped.error,
        code: responseCode,
        reason: responseReason,
      },
      { status: mapped.status }
    );
  }
}
