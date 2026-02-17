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

const SHORTLET_PAYMENT_SELECT =
  "id,booking_id,property_id,guest_user_id,host_user_id,provider,currency,amount_total_minor,status,provider_reference,provider_payload_json,last_verified_at,verify_attempts,needs_reconcile,reconcile_reason,reconcile_locked_until,provider_event_id,provider_tx_id,confirmed_at,created_at,updated_at";
const SHORTLET_PAYMENT_SELECT_LEGACY =
  "id,booking_id,property_id,guest_user_id,host_user_id,provider,currency,amount_total_minor,status,provider_reference,provider_payload_json,created_at,updated_at";
const SHORTLET_PAYMENT_RECONCILE_COLUMNS = [
  "last_verified_at",
  "verify_attempts",
  "needs_reconcile",
  "reconcile_reason",
  "reconcile_locked_until",
  "provider_event_id",
  "provider_tx_id",
  "confirmed_at",
] as const;

const TERMINAL_BOOKING_STATUSES = new Set([
  "confirmed",
  "declined",
  "cancelled",
  "expired",
  "completed",
]);

function isMissingShortletPaymentColumnsError(
  error: SupabaseLikeError | null | undefined,
  columns: readonly string[]
) {
  const message = String(error?.message || "").toLowerCase();
  if (!message.includes("does not exist")) return false;
  return columns.some(
    (column) =>
      message.includes(`shortlet_payments.${column.toLowerCase()}`) ||
      message.includes(`column ${column.toLowerCase()}`) ||
      message.includes(`column \"${column.toLowerCase()}\"`)
  );
}

export type ShortletPaymentRow = {
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
  last_verified_at?: string | null;
  verify_attempts?: number;
  needs_reconcile?: boolean;
  reconcile_reason?: string | null;
  reconcile_locked_until?: string | null;
  provider_event_id?: string | null;
  provider_tx_id?: string | null;
  confirmed_at?: string | null;
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
    last_verified_at:
      typeof row.last_verified_at === "string" && row.last_verified_at.trim()
        ? row.last_verified_at
        : null,
    verify_attempts: Math.max(0, Math.trunc(Number(row.verify_attempts || 0))),
    needs_reconcile: Boolean(row.needs_reconcile),
    reconcile_reason:
      typeof row.reconcile_reason === "string" && row.reconcile_reason.trim()
        ? row.reconcile_reason
        : null,
    reconcile_locked_until:
      typeof row.reconcile_locked_until === "string" && row.reconcile_locked_until.trim()
        ? row.reconcile_locked_until
        : null,
    provider_event_id:
      typeof row.provider_event_id === "string" && row.provider_event_id.trim()
        ? row.provider_event_id
        : null,
    provider_tx_id:
      typeof row.provider_tx_id === "string" && row.provider_tx_id.trim()
        ? row.provider_tx_id
        : null,
    confirmed_at:
      typeof row.confirmed_at === "string" && row.confirmed_at.trim()
        ? row.confirmed_at
        : null,
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
  };
}

function normalizeReconcileRow(row: Record<string, unknown> | null): ShortletPaymentReconcileRow | null {
  const payment = normalizePaymentRow(row);
  if (!payment) return null;
  return {
    id: payment.id,
    bookingId: payment.booking_id,
    provider: payment.provider,
    providerReference: payment.provider_reference,
    status: payment.status,
    currency: payment.currency,
    amountTotalMinor: payment.amount_total_minor,
    verifyAttempts: Math.max(0, Math.trunc(Number(payment.verify_attempts || 0))),
    needsReconcile: Boolean(payment.needs_reconcile),
    reconcileReason: payment.reconcile_reason ?? null,
    reconcileLockedUntil: payment.reconcile_locked_until ?? null,
    providerPayload: payment.provider_payload_json,
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
    lastVerifiedAt: payment.last_verified_at ?? null,
    providerEventId: payment.provider_event_id ?? null,
    providerTxId: payment.provider_tx_id ?? null,
  };
}

function getReconcileUnlockedFilter(nowIso: string) {
  return `reconcile_locked_until.is.null,reconcile_locked_until.lt.${nowIso}`;
}

async function resolvePaymentRowByBooking(client: SupabaseClient, bookingId: string) {
  const { data } = await client
    .from("shortlet_payments")
    .select(SHORTLET_PAYMENT_SELECT)
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

export function isTerminalShortletBookingStatus(
  status: ShortletPaymentBookingContext["status"] | string | null | undefined
) {
  return TERMINAL_BOOKING_STATUSES.has(String(status || "").toLowerCase());
}

export type ShortletReconcileReason =
  | "booking_status_transition_failed"
  | "booking_not_found"
  | "booking_not_payable"
  | "provider_not_paid"
  | "provider_verification_failed"
  | "provider_status_unknown"
  | "provider_mismatch";

export type ShortletPaymentReconcileRow = {
  id: string;
  bookingId: string;
  provider: ShortletPaymentProvider;
  providerReference: string;
  status: ShortletPaymentStatus;
  currency: string;
  amountTotalMinor: number;
  verifyAttempts: number;
  needsReconcile: boolean;
  reconcileReason: string | null;
  reconcileLockedUntil: string | null;
  providerPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
  providerEventId: string | null;
  providerTxId: string | null;
};

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
    needs_reconcile: false,
    reconcile_reason: null,
    reconcile_locked_until: null,
    last_verified_at: null,
    provider_event_id: null,
    provider_tx_id: null,
    confirmed_at: null,
    updated_at: nowIso,
  };
  const untypedClient = client as unknown as UntypedAdminClient;
  const selectColumns = SHORTLET_PAYMENT_SELECT;
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
  reconcileReason?: ShortletReconcileReason | null;
  client?: SupabaseClient;
}) {
  const client = getClient(input.client);
  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status: "failed",
    last_verified_at: nowIso,
    needs_reconcile: false,
    reconcile_reason: input.reconcileReason ?? null,
    reconcile_locked_until: null,
    updated_at: nowIso,
  };
  if (input.providerPayload) {
    updatePayload.provider_payload_json = input.providerPayload;
  }
  await client
    .from("shortlet_payments")
    .update(updatePayload)
    .eq("provider", input.provider)
    .eq("provider_reference", input.providerReference)
    .neq("status", "succeeded");
}

export async function listShortletPaymentsForReconcile(input: {
  staleBeforeIso: string;
  nowIso?: string;
  limit?: number;
  client?: SupabaseClient;
}) {
  const client = getClient(input.client);
  const nowIso = input.nowIso || new Date().toISOString();
  const limit = Math.max(1, Math.min(200, Math.trunc(Number(input.limit || 50))));
  const unlockedFilter = getReconcileUnlockedFilter(nowIso);

  const [needsRows, initiatedRows, succeededRows] = await Promise.all([
    client
      .from("shortlet_payments")
      .select(SHORTLET_PAYMENT_SELECT)
      .eq("needs_reconcile", true)
      .or(unlockedFilter)
      .order("updated_at", { ascending: true })
      .limit(limit),
    client
      .from("shortlet_payments")
      .select(SHORTLET_PAYMENT_SELECT)
      .eq("status", "initiated")
      .lte("created_at", input.staleBeforeIso)
      .or(unlockedFilter)
      .order("created_at", { ascending: true })
      .limit(limit),
    client
      .from("shortlet_payments")
      .select(SHORTLET_PAYMENT_SELECT)
      .eq("status", "succeeded")
      .or(unlockedFilter)
      .order("updated_at", { ascending: true })
      .limit(limit),
  ]);

  const errors = [needsRows.error, initiatedRows.error, succeededRows.error].filter(Boolean);
  if (errors.length > 0) {
    throw new Error(errors[0]?.message || "SHORTLET_RECONCILE_CANDIDATES_FAILED");
  }

  const merged = [
    ...(needsRows.data || []),
    ...(initiatedRows.data || []),
    ...(succeededRows.data || []),
  ] as Record<string, unknown>[];

  const deduped = new Map<string, ShortletPaymentReconcileRow>();
  for (const row of merged) {
    const normalized = normalizeReconcileRow(row);
    if (!normalized) continue;
    if (!deduped.has(normalized.id)) {
      deduped.set(normalized.id, normalized);
    }
  }
  return Array.from(deduped.values()).slice(0, limit);
}

export async function lockShortletPaymentForReconcile(input: {
  paymentId: string;
  verifyAttempts: number;
  lockUntilIso: string;
  nowIso?: string;
  client?: SupabaseClient;
}) {
  const client = getClient(input.client);
  const nowIso = input.nowIso || new Date().toISOString();
  const unlockedFilter = getReconcileUnlockedFilter(nowIso);
  const { data, error } = await client
    .from("shortlet_payments")
    .update({
      verify_attempts: Math.max(0, Math.trunc(Number(input.verifyAttempts || 0))) + 1,
      reconcile_locked_until: input.lockUntilIso,
      last_verified_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", input.paymentId)
    .or(unlockedFilter)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "SHORTLET_RECONCILE_LOCK_FAILED");
  }

  return Boolean(data && typeof data.id === "string");
}

export async function markShortletPaymentNeedsReconcile(input: {
  paymentId: string;
  reason: ShortletReconcileReason;
  lockUntilIso?: string | null;
  providerPayload?: Record<string, unknown>;
  nowIso?: string;
  client?: SupabaseClient;
}) {
  const client = getClient(input.client);
  const nowIso = input.nowIso || new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    needs_reconcile: true,
    reconcile_reason: input.reason,
    reconcile_locked_until: input.lockUntilIso ?? null,
    last_verified_at: nowIso,
    updated_at: nowIso,
  };
  if (input.providerPayload) {
    updatePayload.provider_payload_json = input.providerPayload;
  }
  const { error } = await client
    .from("shortlet_payments")
    .update(updatePayload)
    .eq("id", input.paymentId);
  if (error) {
    throw new Error(error.message || "SHORTLET_RECONCILE_MARK_FAILED");
  }
}

export async function clearShortletPaymentReconcileState(input: {
  paymentId: string;
  nowIso?: string;
  client?: SupabaseClient;
}) {
  const client = getClient(input.client);
  const nowIso = input.nowIso || new Date().toISOString();
  const { error } = await client
    .from("shortlet_payments")
    .update({
      needs_reconcile: false,
      reconcile_reason: null,
      reconcile_locked_until: null,
      updated_at: nowIso,
    })
    .eq("id", input.paymentId);
  if (error) {
    throw new Error(error.message || "SHORTLET_RECONCILE_CLEAR_FAILED");
  }
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

  if (
    status === "pending" ||
    status === "confirmed" ||
    status === "completed" ||
    status === "declined" ||
    status === "cancelled" ||
    status === "expired"
  ) {
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
    if (
      freshStatus === "pending" ||
      freshStatus === "confirmed" ||
      freshStatus === "completed" ||
      freshStatus === "declined" ||
      freshStatus === "cancelled" ||
      freshStatus === "expired"
    ) {
      return finalizeContext(freshStatus, false);
    }
    throw new Error("BOOKING_STATUS_UPDATE_FAILED");
  }

  return finalizeContext(nextStatus, true);
}

function mapBookingConfirmErrorToReconcileReason(message: string): ShortletReconcileReason {
  const normalized = String(message || "").toUpperCase();
  if (normalized.includes("BOOKING_NOT_FOUND")) return "booking_not_found";
  if (normalized.includes("BOOKING_NOT_PAYABLE")) return "booking_not_payable";
  if (normalized.includes("BOOKING_STATUS_UPDATE_FAILED")) return "booking_status_transition_failed";
  return "booking_status_transition_failed";
}

export async function markShortletPaymentSucceededAndConfirmBooking(input: {
  provider: ShortletPaymentProvider;
  providerReference: string;
  providerPayload?: Record<string, unknown>;
  providerEventId?: string | null;
  providerTxId?: string | null;
  client?: SupabaseClient;
}) {
  const client = getClient(input.client);
  const nowIso = new Date().toISOString();
  let paymentQuery = await client
    .from("shortlet_payments")
    .select(SHORTLET_PAYMENT_SELECT)
    .eq("provider", input.provider)
    .eq("provider_reference", input.providerReference)
    .maybeSingle();
  let paymentQueryError = (paymentQuery.error ?? null) as SupabaseLikeError | null;
  if (isMissingShortletPaymentColumnsError(paymentQueryError, SHORTLET_PAYMENT_RECONCILE_COLUMNS)) {
    paymentQuery = await client
      .from("shortlet_payments")
      .select(SHORTLET_PAYMENT_SELECT_LEGACY)
      .eq("provider", input.provider)
      .eq("provider_reference", input.providerReference)
      .maybeSingle();
    paymentQueryError = (paymentQuery.error ?? null) as SupabaseLikeError | null;
  }
  const data = paymentQuery.data as Record<string, unknown> | null;

  if (paymentQueryError || !data) {
    return {
      ok: false as const,
      reason: "PAYMENT_NOT_FOUND",
    };
  }

  const currentPayment = normalizePaymentRow(data as Record<string, unknown>) as ShortletPaymentRow;
  const mergedPayload = {
    ...(currentPayment.provider_payload_json || {}),
    ...(input.providerPayload || {}),
  };

  const nextProviderEventId =
    typeof input.providerEventId === "string" && input.providerEventId.trim()
      ? input.providerEventId
      : currentPayment.provider_event_id;
  const nextProviderTxId =
    typeof input.providerTxId === "string" && input.providerTxId.trim()
      ? input.providerTxId
      : currentPayment.provider_tx_id;

  let updateQuery = await client
    .from("shortlet_payments")
    .update({
      status: "succeeded",
      provider_payload_json: mergedPayload,
      provider_event_id: nextProviderEventId ?? null,
      provider_tx_id: nextProviderTxId ?? null,
      confirmed_at: currentPayment.confirmed_at || nowIso,
      last_verified_at: nowIso,
      needs_reconcile: false,
      reconcile_reason: null,
      reconcile_locked_until: null,
      updated_at: nowIso,
    })
    .eq("id", currentPayment.id)
    .select(SHORTLET_PAYMENT_SELECT)
    .maybeSingle();
  let updateError = (updateQuery.error ?? null) as SupabaseLikeError | null;
  if (isMissingShortletPaymentColumnsError(updateError, SHORTLET_PAYMENT_RECONCILE_COLUMNS)) {
    updateQuery = await client
      .from("shortlet_payments")
      .update({
        status: "succeeded",
        provider_payload_json: mergedPayload,
        updated_at: nowIso,
      })
      .eq("id", currentPayment.id)
      .select(SHORTLET_PAYMENT_SELECT_LEGACY)
      .maybeSingle();
    updateError = (updateQuery.error ?? null) as SupabaseLikeError | null;
  }
  const updatedPaymentRow = updateQuery.data as Record<string, unknown> | null;

  if (updateError || !updatedPaymentRow) {
    return {
      ok: false as const,
      reason: "PAYMENT_UPDATE_FAILED",
    };
  }

  const updatedPayment = normalizePaymentRow(updatedPaymentRow as Record<string, unknown>) as ShortletPaymentRow;

  try {
    const booking = await confirmBookingAfterPayment({
      bookingId: updatedPayment.booking_id,
      providerReference: input.providerReference,
      client,
    });

    return {
      ok: true as const,
      payment: updatedPayment,
      booking,
      alreadySucceeded: currentPayment.status === "succeeded",
    };
  } catch (error) {
    const reason = mapBookingConfirmErrorToReconcileReason(
      error instanceof Error ? error.message : "BOOKING_STATUS_UPDATE_FAILED"
    );

    try {
      await markShortletPaymentNeedsReconcile({
        paymentId: updatedPayment.id,
        reason,
        lockUntilIso: new Date(Date.now() + 60 * 1000).toISOString(),
        providerPayload: mergedPayload,
        nowIso,
        client,
      });
    } catch {
      // Reconcile columns may not exist on older schemas; canonical status update already happened.
    }

    return {
      ok: false as const,
      reason: "BOOKING_STATUS_TRANSITION_FAILED",
      reconcileReason: reason,
    };
  }
}

export async function getShortletPaymentByReference(input: {
  provider: ShortletPaymentProvider;
  providerReference: string;
  client?: SupabaseClient;
}) {
  const client = getClient(input.client);
  const { data } = await client
    .from("shortlet_payments")
    .select(SHORTLET_PAYMENT_SELECT)
    .eq("provider", input.provider)
    .eq("provider_reference", input.providerReference)
    .maybeSingle();

  return normalizePaymentRow((data as Record<string, unknown> | null) ?? null);
}
