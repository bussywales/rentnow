import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { requireRole } from "@/lib/authz";
import { getSiteUrl } from "@/lib/env";
import { createNotification } from "@/lib/notifications/notifications.server";
import { buildTenantManualCheckinDetailsEmail } from "@/lib/email/templates/shortlet-reminders";
import { getLatestShortletPaymentStatusForBooking } from "@/lib/shortlet/shortlet.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/shortlet/bookings/[id]/send-checkin";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

type BookingRow = {
  id: string;
  property_id: string;
  host_user_id: string;
  guest_user_id: string;
  status: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_amount_minor: number;
  currency: string;
  property_title: string | null;
  city: string | null;
};

type CheckinSettingsRow = {
  checkin_window_start: string | null;
  checkin_window_end: string | null;
  checkout_time: string | null;
  access_method: string | null;
  access_code_hint: string | null;
  parking_info: string | null;
  wifi_info: string | null;
  house_rules: string | null;
};

function formatTime(value: string | null | undefined): string {
  if (!value) return "Not specified";
  const [hourText, minuteText = "00"] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function hasShareableCheckinDetails(row: CheckinSettingsRow | null) {
  if (!row) return false;
  return Boolean(
    (row.checkin_window_start && row.checkin_window_start.trim()) ||
      (row.checkin_window_end && row.checkin_window_end.trim()) ||
      (row.checkout_time && row.checkout_time.trim()) ||
      (row.access_method && row.access_method.trim()) ||
      (row.access_code_hint && row.access_code_hint.trim()) ||
      (row.parking_info && row.parking_info.trim()) ||
      (row.wifi_info && row.wifi_info.trim()) ||
      (row.house_rules && row.house_rules.trim())
  );
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) return { ok: false };
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "PropatyHub <no-reply@propatyhub.com>",
      to,
      subject,
      html,
    }),
  }).catch(() => null);
  return { ok: !!response?.ok };
}

async function defaultLoadBooking(supabase: SupabaseClient, bookingId: string): Promise<BookingRow | null> {
  const { data, error } = await supabase
    .from("shortlet_bookings")
    .select(
      "id,property_id,host_user_id,guest_user_id,status,check_in,check_out,nights,total_amount_minor,currency,properties!inner(title,city)"
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to load booking");
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const relation = row.properties as
    | Record<string, unknown>
    | Array<Record<string, unknown>>
    | null
    | undefined;
  const property = Array.isArray(relation) ? (relation[0] ?? null) : relation ?? null;
  return {
    id: String(row.id || ""),
    property_id: String(row.property_id || ""),
    host_user_id: String(row.host_user_id || ""),
    guest_user_id: String(row.guest_user_id || ""),
    status: String(row.status || ""),
    check_in: String(row.check_in || ""),
    check_out: String(row.check_out || ""),
    nights: Math.max(0, Math.trunc(Number(row.nights || 0))),
    total_amount_minor: Math.max(0, Math.trunc(Number(row.total_amount_minor || 0))),
    currency: String(row.currency || "NGN"),
    property_title: typeof property?.title === "string" ? property.title : null,
    city: typeof property?.city === "string" ? property.city : null,
  };
}

async function defaultLoadCheckinSettings(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  propertyId: string
): Promise<CheckinSettingsRow | null> {
  const untyped = adminClient as unknown as UntypedAdminClient;
  const { data, error } = await untyped
    .from("shortlet_settings")
    .select(
      "checkin_window_start,checkin_window_end,checkout_time,access_method,access_code_hint,parking_info,wifi_info,house_rules"
    )
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to load check-in settings");
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    checkin_window_start:
      typeof row.checkin_window_start === "string" ? row.checkin_window_start : null,
    checkin_window_end:
      typeof row.checkin_window_end === "string" ? row.checkin_window_end : null,
    checkout_time: typeof row.checkout_time === "string" ? row.checkout_time : null,
    access_method: typeof row.access_method === "string" ? row.access_method : null,
    access_code_hint: typeof row.access_code_hint === "string" ? row.access_code_hint : null,
    parking_info: typeof row.parking_info === "string" ? row.parking_info : null,
    wifi_info: typeof row.wifi_info === "string" ? row.wifi_info : null,
    house_rules: typeof row.house_rules === "string" ? row.house_rules : null,
  };
}

async function defaultReserveManualShareEvent(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  bookingId: string
) {
  const untyped = adminClient as unknown as UntypedAdminClient;
  const { error } = await untyped
    .from("shortlet_reminder_events")
    .insert({
      booking_id: bookingId,
      event_key: "manual_checkin_shared",
    });
  if (!error) return { duplicate: false };
  const errorCode =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  if (errorCode === "23505") return { duplicate: true };
  const errorMessage =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  throw new Error(errorMessage || "Unable to reserve check-in share event");
}

async function defaultResolveUserEmail(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  userId: string
) {
  try {
    const { data } = await adminClient.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export type ShortletSendCheckinDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  requireRole: typeof requireRole;
  hasActiveDelegation: typeof hasActiveDelegation;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  loadBooking: typeof defaultLoadBooking;
  getLatestShortletPaymentStatusForBooking: typeof getLatestShortletPaymentStatusForBooking;
  loadCheckinSettings: typeof defaultLoadCheckinSettings;
  reserveManualShareEvent: typeof defaultReserveManualShareEvent;
  resolveUserEmail: typeof defaultResolveUserEmail;
  sendEmail: typeof sendEmail;
  createNotification: typeof createNotification;
  getSiteUrl: typeof getSiteUrl;
};

const defaultDeps: ShortletSendCheckinDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  requireRole,
  hasActiveDelegation,
  createServerSupabaseClient,
  createServiceRoleClient,
  loadBooking: defaultLoadBooking,
  getLatestShortletPaymentStatusForBooking,
  loadCheckinSettings: defaultLoadCheckinSettings,
  reserveManualShareEvent: defaultReserveManualShareEvent,
  resolveUserEmail: defaultResolveUserEmail,
  sendEmail,
  createNotification,
  getSiteUrl,
};

export async function postShortletSendCheckinResponse(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: ShortletSendCheckinDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Booking id required" }, { status: 422 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const booking = await deps.loadBooking(supabase, id).catch(() => null);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  let allowed = auth.role === "admin" || auth.user.id === booking.host_user_id;
  if (!allowed && auth.role === "agent") {
    allowed = await deps.hasActiveDelegation(supabase, auth.user.id, booking.host_user_id);
  }
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (booking.status !== "confirmed") {
    return NextResponse.json({ error: "Check-in details can only be shared for confirmed bookings." }, { status: 409 });
  }

  const adminClient = deps.createServiceRoleClient();
  const paymentStatus = await deps
    .getLatestShortletPaymentStatusForBooking({ client: adminClient, bookingId: booking.id })
    .catch(() => null);
  if (String(paymentStatus || "").trim().toLowerCase() !== "succeeded") {
    return NextResponse.json({ error: "Payment is not confirmed for this booking." }, { status: 409 });
  }

  const checkinSettings = await deps.loadCheckinSettings(adminClient, booking.property_id).catch(() => null);
  if (!hasShareableCheckinDetails(checkinSettings)) {
    return NextResponse.json({ error: "Add check-in details in shortlet settings before sharing." }, { status: 409 });
  }

  const reserved = await deps.reserveManualShareEvent(adminClient, booking.id);
  if (reserved.duplicate) {
    return NextResponse.json({ ok: true, alreadySent: true });
  }

  const guestEmail = await deps.resolveUserEmail(adminClient, booking.guest_user_id);
  if (guestEmail) {
    const siteUrl = await deps.getSiteUrl();
    const template = buildTenantManualCheckinDetailsEmail({
      propertyTitle: booking.property_title || "Shortlet listing",
      city: booking.city,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      amountMinor: booking.total_amount_minor,
      currency: booking.currency,
      bookingId: booking.id,
      siteUrl,
      checkinWindow: `${formatTime(checkinSettings?.checkin_window_start)} - ${formatTime(checkinSettings?.checkin_window_end)}`,
      checkoutTime: formatTime(checkinSettings?.checkout_time),
      accessMethod: checkinSettings?.access_method || null,
      accessHint: checkinSettings?.access_code_hint || null,
      parkingInfo: checkinSettings?.parking_info || null,
      wifiInfo: checkinSettings?.wifi_info || null,
      houseRules: checkinSettings?.house_rules || null,
    });
    await deps.sendEmail(guestEmail, template.subject, template.html);
  }

  await deps.createNotification({
    userId: booking.guest_user_id,
    type: "shortlet_booking_host_update",
    title: `Check-in details shared: ${booking.property_title || "Shortlet listing"}`,
    body: "Your host shared arrival details for your stay.",
    href: `/trips/${booking.id}`,
    dedupeKey: `shortlet:${booking.id}:reminder:manual_checkin_shared:guest`,
  });

  return NextResponse.json({ ok: true, alreadySent: false });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return postShortletSendCheckinResponse(request, context, defaultDeps);
}
