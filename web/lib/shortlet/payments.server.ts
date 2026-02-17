import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePostPaymentBookingStatus } from "@/lib/shortlet/bookings";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export type ShortletPaymentProvider = "stripe" | "paystack";
export type ShortletPaymentStatus = "initiated" | "succeeded" | "failed" | "refunded";
export type ShortletPaymentProviderUnavailableReason =
  | "missing_currency"
  | "both_providers_disabled"
  | "currency_ngn_paystack_disabled"
  | `unsupported_currency:${string}`;
export type ShortletPaymentProviderDecision = {
  propertyCountry: string | null;
  bookingCurrency: string;
  wantsPaystack: boolean;
  stripeEnabled: boolean;
  paystackEnabled: boolean;
  chosenProvider: ShortletPaymentProvider | null;
  reason: ShortletPaymentProviderUnavailableReason | null;
};

type SupabaseLikeError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
  status?: number | null;
};

type ShortletPaymentRow = {
  id: string;
  booking_id: string;
  property_id: string;
  guest_user_id: string;
  host_user_id: string;
  provider: ShortletPaymentProvider;
  currency: string;
  amount_total_minor: number;
  status: ShortletPaymentStatus;
  provider_reference: string;
  provider_payload_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ShortletPaymentBookingContext = {
  bookingId: string;
  propertyId: string;
  guestUserId: string;
  hostUserId: string;
  status:
    | "pending_payment"
    | "pending"
    | "confirmed"
    | "declined"
    | "cancelled"
    | "expired"
    | "completed";
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmountMinor: number;
  currency: string;
  bookingMode: "instant" | "request";
  listingTitle: string | null;
  city: string | null;
  countryCode: string | null;
  paymentReference: string | null;
  payment: ShortletPaymentRow | null;
};

function parseShortletBookingMode(snapshot: Record<string, unknown>): "instant" | "request" {
  return snapshot.booking_mode === "instant" ? "instant" : "request";
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function normalizePropertyRelation(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function normalizeUuid(input: string | null | undefined): string | null {
  const value = String(input || "").trim();
  if (!value) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value.toLowerCase();
  }
  if (/^[0-9a-f]{32}$/i.test(value)) {
    const compact = value.toLowerCase();
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(
      16,
      20
    )}-${compact.slice(20)}`;
  }
  return null;
}

function normalizeAmountCurrencyCode(input: string | null | undefined): string {
  const raw = String(input || "").trim();
  if (!raw) return "NGN";
  if (raw.includes("₦")) return "NGN";
  return raw.toUpperCase();
}

export function resolveCurrencyMinorUnit(currency: string | null | undefined): number {
  const normalized = normalizeAmountCurrencyCode(currency);
  if (normalized === "JPY" || normalized === "KRW") return 1;
  return 100;
}

export function deriveShortletAmountMinorFromNumericTotal(input: {
  total: number;
  currency: string | null | undefined;
}): number {
  const total = Number(input.total);
  if (!Number.isFinite(total)) return Number.NaN;
  const minorUnit = resolveCurrencyMinorUnit(input.currency);
  return Math.round(total * minorUnit);
}

export function extractBookingIdFromShortletPaystackReference(reference: string | null | undefined) {
  const normalized = String(reference || "").trim();
  if (!normalized) return null;
  const refMatch = /^shb_ps_([^_]+)_\d+$/i.exec(normalized);
  if (!refMatch) return null;
  return normalizeUuid(refMatch[1]);
}

export function resolveShortletBookingIdFromPaystackPayload(input: {
  reference: string | null | undefined;
  payload: Record<string, unknown> | null | undefined;
}) {
  const payload = toRecord(input.payload);
  const data = toRecord(payload.data);
  const metadata = toRecord(data.metadata);
  const fromMetadata =
    normalizeUuid(typeof metadata.booking_id === "string" ? metadata.booking_id : null) ||
    normalizeUuid(typeof metadata.bookingId === "string" ? metadata.bookingId : null);
  if (fromMetadata) return fromMetadata;
  return extractBookingIdFromShortletPaystackReference(input.reference);
}

function normalizePaymentRow(row: Record<string, unknown> | null): ShortletPaymentRow | null {
  if (!row) return null;
  return {
    id: String(row.id || ""),
    booking_id: String(row.booking_id || ""),
    property_id: String(row.property_id || ""),
    guest_user_id: String(row.guest_user_id || ""),
    host_user_id: String(row.host_user_id || ""),
    provider: row.provider === "stripe" ? "stripe" : "paystack",
    currency: String(row.currency || "NGN"),
    amount_total_minor: Math.max(0, Math.trunc(Number(row.amount_total_minor || 0))),
    status:
      row.status === "succeeded"
        ? "succeeded"
        : row.status === "failed"
          ? "failed"
          : row.status === "refunded"
            ? "refunded"
            : "initiated",
    provider_reference: String(row.provider_reference || ""),
    provider_payload_json: asObject(row.provider_payload_json),
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
  };
}

async function resolvePaymentRowByBooking(client: SupabaseClient, bookingId: string) {
  const { data } = await client
    .from("shortlet_payments")
    .select(
      "id,booking_id,property_id,guest_user_id,host_user_id,provider,currency,amount_total_minor,status,provider_reference,provider_payload_json,created_at,updated_at"
    )
    .eq("booking_id", bookingId)
    .maybeSingle();

  return normalizePaymentRow((data as Record<string, unknown> | null) ?? null);
}

function getClient(inputClient?: SupabaseClient) {
  if (inputClient) return inputClient;
  if (!hasServiceRoleEnv()) {
    throw new Error("SERVICE_ROLE_MISSING");
  }
  return createServiceRoleClient();
}

export async function getShortletPaymentsProviderFlags() {
  const [stripeEnabled, paystackEnabled] = await Promise.all([
    getAppSettingBool(APP_SETTING_KEYS.shortletPaymentsStripeEnabled, true),
    getAppSettingBool(APP_SETTING_KEYS.shortletPaymentsPaystackEnabled, true),
  ]);

  return {
    stripeEnabled,
    paystackEnabled,
  };
}

export async function getShortletPaymentCheckoutContext(input: {
  bookingId: string;
  guestUserId: string;
  client?: SupabaseClient;
}): Promise<ShortletPaymentBookingContext | null> {
  const booking = await getShortletPaymentCheckoutContextByBookingId({
    bookingId: input.bookingId,
    client: input.client,
  });
  if (!booking) return null;
  if (!booking.guestUserId || booking.guestUserId !== input.guestUserId) return null;
  return booking;
}

export async function getShortletPaymentCheckoutContextByBookingId(input: {
  bookingId: string;
  client?: SupabaseClient;
}): Promise<ShortletPaymentBookingContext | null> {
  const client = getClient(input.client);
  const { data, error } = await client
    .from("shortlet_bookings")
    .select(
      "id,property_id,guest_user_id,host_user_id,status,check_in,check_out,nights,total_amount_minor,currency,payment_reference,pricing_snapshot_json,properties!inner(id,title,city,country_code)"
    )
    .eq("id", input.bookingId)
    .maybeSingle();

  if (error || !data) return null;
  const bookingRow = data as Record<string, unknown>;
  const guestUserId = String(bookingRow.guest_user_id || "");
  if (!guestUserId) return null;

  const property = normalizePropertyRelation(bookingRow.properties);
  const snapshot = asObject(bookingRow.pricing_snapshot_json);
  const payment = await resolvePaymentRowByBooking(client, input.bookingId);

  return {
    bookingId: String(bookingRow.id || ""),
    propertyId: String(bookingRow.property_id || ""),
    guestUserId,
    hostUserId: String(bookingRow.host_user_id || ""),
    status:
      (String(bookingRow.status || "pending_payment") as ShortletPaymentBookingContext["status"]) ||
      "pending_payment",
    checkIn: String(bookingRow.check_in || ""),
    checkOut: String(bookingRow.check_out || ""),
    nights: Math.max(0, Math.trunc(Number(bookingRow.nights || 0))),
    totalAmountMinor: Math.max(0, Math.trunc(Number(bookingRow.total_amount_minor || 0))),
    currency: String(bookingRow.currency || "NGN"),
    bookingMode: parseShortletBookingMode(snapshot),
    listingTitle: typeof property?.title === "string" ? property.title : null,
    city: typeof property?.city === "string" ? property.city : null,
    countryCode:
      typeof property?.country_code === "string"
        ? String(property.country_code).toUpperCase()
        : null,
    paymentReference:
      typeof bookingRow.payment_reference === "string" ? bookingRow.payment_reference : null,
    payment,
  };
}

export function isBookingPayableStatus(status: ShortletPaymentBookingContext["status"]) {
  return status === "pending_payment";
}

export function isNigeriaShortlet(context: Pick<ShortletPaymentBookingContext, "countryCode" | "currency">) {
  if (context.countryCode === "NG") return true;
  return String(context.currency || "").toUpperCase() === "NGN";
}

function normalizeCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "NIGERIA" || normalized === "NGA") return "NG";
  return normalized;
}

function normalizeCurrencyCode(input: {
  bookingCurrency: string | null | undefined;
  propertyCountry: string | null;
}): { currency: string | null; wasMissing: boolean } {
  const raw = String(input.bookingCurrency || "").trim();
  if (!raw) {
    if (input.propertyCountry === "NG") {
      return { currency: "NGN", wasMissing: true };
    }
    return { currency: null, wasMissing: true };
  }

  if (raw.includes("₦")) {
    return { currency: "NGN", wasMissing: false };
  }

  const normalized = raw.toUpperCase();
  return { currency: normalized || null, wasMissing: false };
}

export function resolveShortletPaymentProviderDecision(input: {
  propertyCountry: string | null | undefined;
  bookingCurrency: string | null | undefined;
  stripeEnabled: boolean;
  paystackEnabled: boolean;
}): ShortletPaymentProviderDecision {
  const propertyCountry = normalizeCountryCode(input.propertyCountry);
  const normalizedCurrency = normalizeCurrencyCode({
    bookingCurrency: input.bookingCurrency,
    propertyCountry,
  });
  const bookingCurrency = normalizedCurrency.currency || "";
  const wantsPaystack = propertyCountry === "NG" || bookingCurrency === "NGN";
  let chosenProvider: ShortletPaymentProvider | null = null;
  let reason: ShortletPaymentProviderUnavailableReason | null = null;

  if (!bookingCurrency) {
    reason = "missing_currency";
  } else if (!/^[A-Z]{3}$/.test(bookingCurrency)) {
    reason = `unsupported_currency:${bookingCurrency}`;
  } else if (bookingCurrency === "NGN") {
    if (input.paystackEnabled) {
      chosenProvider = "paystack";
    } else if (input.stripeEnabled) {
      chosenProvider = "stripe";
    } else {
      reason = "currency_ngn_paystack_disabled";
    }
  } else if (input.stripeEnabled) {
    chosenProvider = "stripe";
  } else if (input.paystackEnabled) {
    chosenProvider = "paystack";
  } else {
    reason = "both_providers_disabled";
  }

  if (!chosenProvider && !reason && !input.stripeEnabled && !input.paystackEnabled) {
    reason = "both_providers_disabled";
  }

  return {
    propertyCountry,
    bookingCurrency,
    wantsPaystack,
    stripeEnabled: input.stripeEnabled,
    paystackEnabled: input.paystackEnabled,
    chosenProvider,
    reason,
  };
}

export async function upsertShortletPaymentIntent(input: {
  booking: ShortletPaymentBookingContext;
  provider: ShortletPaymentProvider;
  providerReference: string;
  amountMinor: number;
  providerPayload?: Record<string, unknown>;
  client?: SupabaseClient;
}) {
  const client = getClient(input.client);
  const existing = await resolvePaymentRowByBooking(client, input.booking.bookingId);
  if (existing?.status === "succeeded") {
    return {
      payment: existing,
      alreadySucceeded: true,
    };
  }

  const amountMinor = Math.max(0, Math.trunc(Number(input.amountMinor || 0)));
  if (!amountMinor) {
    const amountError = new Error("SHORTLET_INVALID_AMOUNT") as Error & SupabaseLikeError;
    amountError.code = "SHORTLET_INVALID_AMOUNT";
    throw amountError;
  }

  const nowIso = new Date().toISOString();
  const baseRow = {
    booking_id: input.booking.bookingId,
    property_id: input.booking.propertyId,
    guest_user_id: input.booking.guestUserId,
    host_user_id: input.booking.hostUserId,
    provider: input.provider,
    currency: input.booking.currency,
    amount_total_minor: amountMinor,
    status: "initiated",
    provider_reference: input.providerReference,
    provider_payload_json: input.providerPayload || {},
    updated_at: nowIso,
  };
  const untypedClient = client as unknown as UntypedAdminClient;
  const selectColumns =
    "id,booking_id,property_id,guest_user_id,host_user_id,provider,currency,amount_total_minor,status,provider_reference,provider_payload_json,created_at,updated_at";
  const legacyCompatibleRow = {
    ...baseRow,
    amount_minor: amountMinor,
    reference: input.providerReference,
  };

  let queryResult = await untypedClient
    .from("shortlet_payments")
    .upsert(legacyCompatibleRow, { onConflict: "booking_id" })
    .select(selectColumns)
    .maybeSingle();

  const queryError = (queryResult.error ?? null) as SupabaseLikeError | null;
  const legacyColumnMissing =
    !!queryError?.message &&
    (queryError.message.includes("amount_minor") || queryError.message.includes("reference")) &&
    queryError.message.includes("does not exist");

  if (legacyColumnMissing) {
    queryResult = await untypedClient
      .from("shortlet_payments")
      .upsert(baseRow, { onConflict: "booking_id" })
      .select(selectColumns)
      .maybeSingle();
  }

  const { data } = queryResult;
  const error = (queryResult.error ?? null) as SupabaseLikeError | null;

  if (error || !data) {
    const upsertError = new Error(error?.message || "SHORTLET_PAYMENT_UPSERT_FAILED") as Error &
      SupabaseLikeError;
    upsertError.details = error?.details ?? null;
    upsertError.hint = error?.hint ?? null;
    upsertError.code = error?.code ?? null;
    upsertError.status = error?.status ?? null;
    throw upsertError;
  }

  return {
    payment: normalizePaymentRow(data as Record<string, unknown>) as ShortletPaymentRow,
    alreadySucceeded: false,
  };
}

export async function markShortletPaymentFailed(input: {
  provider: ShortletPaymentProvider;
  providerReference: string;
  providerPayload?: Record<string, unknown>;
  client?: SupabaseClient;
}) {
  const client = getClient(input.client);
  await client
    .from("shortlet_payments")
    .update({
      status: "failed",
      provider_payload_json: input.providerPayload || {},
      updated_at: new Date().toISOString(),
    })
    .eq("provider", input.provider)
    .eq("provider_reference", input.providerReference)
    .neq("status", "succeeded");
}

async function confirmBookingAfterPayment(input: {
  bookingId: string;
  providerReference: string;
  client: SupabaseClient;
}) {
  const { data: bookingData, error } = await input.client
    .from("shortlet_bookings")
    .select(
      "id,property_id,guest_user_id,host_user_id,status,check_in,check_out,nights,total_amount_minor,currency,payment_reference,pricing_snapshot_json,properties!inner(title,city,country_code)"
    )
    .eq("id", input.bookingId)
    .maybeSingle();

  if (error || !bookingData) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  const booking = bookingData as Record<string, unknown>;
  const snapshot = asObject(booking.pricing_snapshot_json);
  const bookingMode = parseShortletBookingMode(snapshot);
  const status = String(booking.status || "pending_payment");
  const property = normalizePropertyRelation(booking.properties);

  const finalizeContext = (resolvedStatus: string, transitioned: boolean) => ({
    bookingId: String(booking.id || ""),
    propertyId: String(booking.property_id || ""),
    guestUserId: String(booking.guest_user_id || ""),
    hostUserId: String(booking.host_user_id || ""),
    checkIn: String(booking.check_in || ""),
    checkOut: String(booking.check_out || ""),
    nights: Math.max(0, Math.trunc(Number(booking.nights || 0))),
    totalAmountMinor: Math.max(0, Math.trunc(Number(booking.total_amount_minor || 0))),
    currency: String(booking.currency || "NGN"),
    listingTitle: typeof property?.title === "string" ? String(property.title || "") : null,
    city: typeof property?.city === "string" ? String(property.city || "") : null,
    countryCode:
      typeof property?.country_code === "string"
        ? String(property.country_code || "").toUpperCase()
        : null,
    status: resolvedStatus as ShortletPaymentBookingContext["status"],
    bookingMode,
    transitioned,
  });

  if (status === "pending" || status === "confirmed" || status === "completed") {
    return finalizeContext(status, false);
  }

  if (status !== "pending_payment") {
    throw new Error("BOOKING_NOT_PAYABLE");
  }

  const nextStatus = resolvePostPaymentBookingStatus(status as ShortletPaymentBookingContext["status"], bookingMode);
  const expiresAt =
    nextStatus === "pending"
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { data: updatedRow } = await input.client
    .from("shortlet_bookings")
    .update({
      status: nextStatus,
      payment_reference: input.providerReference,
      expires_at: expiresAt,
      refund_required: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bookingId)
    .eq("status", "pending_payment")
    .select("status")
    .maybeSingle();

  if (!updatedRow) {
    const { data: fresh } = await input.client
      .from("shortlet_bookings")
      .select("status")
      .eq("id", input.bookingId)
      .maybeSingle();
    const freshStatus = String((fresh as { status?: string } | null)?.status || "");
    if (freshStatus === "pending" || freshStatus === "confirmed" || freshStatus === "completed") {
      return finalizeContext(freshStatus, false);
    }
    throw new Error("BOOKING_STATUS_UPDATE_FAILED");
  }

  return finalizeContext(nextStatus, true);
}

export async function markShortletPaymentSucceededAndConfirmBooking(input: {
  provider: ShortletPaymentProvider;
  providerReference: string;
  providerPayload?: Record<string, unknown>;
  client?: SupabaseClient;
}) {
  const client = getClient(input.client);
  const { data, error } = await client
    .from("shortlet_payments")
    .select(
      "id,booking_id,property_id,guest_user_id,host_user_id,provider,currency,amount_total_minor,status,provider_reference,provider_payload_json,created_at,updated_at"
    )
    .eq("provider", input.provider)
    .eq("provider_reference", input.providerReference)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      reason: "PAYMENT_NOT_FOUND",
    };
  }

  const payment = normalizePaymentRow(data as Record<string, unknown>) as ShortletPaymentRow;

  if (payment.status !== "succeeded") {
    const { error: updateError } = await client
      .from("shortlet_payments")
      .update({
        status: "succeeded",
        provider_payload_json: input.providerPayload || {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .neq("status", "succeeded");

    if (updateError) {
      throw new Error(updateError.message || "SHORTLET_PAYMENT_UPDATE_FAILED");
    }
  }

  const booking = await confirmBookingAfterPayment({
    bookingId: payment.booking_id,
    providerReference: input.providerReference,
    client,
  });

  return {
    ok: true as const,
    payment,
    booking,
    alreadySucceeded: payment.status === "succeeded",
  };
}

export async function getShortletPaymentByReference(input: {
  provider: ShortletPaymentProvider;
  providerReference: string;
  client?: SupabaseClient;
}) {
  const client = getClient(input.client);
  const { data } = await client
    .from("shortlet_payments")
    .select(
      "id,booking_id,property_id,guest_user_id,host_user_id,provider,currency,amount_total_minor,status,provider_reference,provider_payload_json,created_at,updated_at"
    )
    .eq("provider", input.provider)
    .eq("provider_reference", input.providerReference)
    .maybeSingle();

  return normalizePaymentRow((data as Record<string, unknown> | null) ?? null);
}
