import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

export type ShortletPaymentProvider = "stripe" | "paystack";
export type ShortletPaymentStatus = "initiated" | "succeeded" | "failed" | "refunded";

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
  if (!guestUserId || guestUserId !== input.guestUserId) return null;

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

export async function upsertShortletPaymentIntent(input: {
  booking: ShortletPaymentBookingContext;
  provider: ShortletPaymentProvider;
  providerReference: string;
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

  const nowIso = new Date().toISOString();
  const row = {
    booking_id: input.booking.bookingId,
    property_id: input.booking.propertyId,
    guest_user_id: input.booking.guestUserId,
    host_user_id: input.booking.hostUserId,
    provider: input.provider,
    currency: input.booking.currency,
    amount_total_minor: input.booking.totalAmountMinor,
    status: "initiated",
    provider_reference: input.providerReference,
    provider_payload_json: input.providerPayload || {},
    updated_at: nowIso,
  };

  const { data, error } = await client
    .from("shortlet_payments")
    .upsert(row, { onConflict: "booking_id" })
    .select(
      "id,booking_id,property_id,guest_user_id,host_user_id,provider,currency,amount_total_minor,status,provider_reference,provider_payload_json,created_at,updated_at"
    )
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "SHORTLET_PAYMENT_UPSERT_FAILED");
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

  const nextStatus = bookingMode === "instant" ? "confirmed" : "pending";
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
