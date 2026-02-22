import { NextResponse, type NextRequest } from "next/server";
import { getSiteUrl } from "@/lib/env";
import { createNotification } from "@/lib/notifications/notifications.server";
import {
  buildHostCheckinHeadsUpEmail,
  buildTenantCheckinReminderEmail,
  buildTenantCheckoutReminderEmail,
} from "@/lib/email/templates/shortlet-reminders";
import {
  filterUnsentReminderDispatches,
  resolveReminderDispatches,
  type ReminderPaymentStatus,
  type ShortletReminderBookingCandidate,
  type ShortletReminderEventKey,
} from "@/lib/shortlet/reminders.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { toDateKey } from "@/lib/shortlet/availability";

export const dynamic = "force-dynamic";

const routeLabel = "/api/internal/shortlet/send-reminders";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

type InternalReminderDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getCronSecret: () => string;
  now: () => Date;
  sendEmail: typeof sendEmail;
  createNotification: typeof createNotification;
  getSiteUrl: typeof getSiteUrl;
};

const defaultDeps: InternalReminderDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  getCronSecret: () => process.env.CRON_SECRET || "",
  now: () => new Date(),
  sendEmail,
  createNotification,
  getSiteUrl,
};

function hasValidCronSecret(request: NextRequest, expected: string) {
  if (!expected) return false;
  return request.headers.get("x-cron-secret") === expected;
}

function normalizePaymentStatus(value: unknown): ReminderPaymentStatus {
  return String(value || "").trim().toLowerCase() === "succeeded" ? "succeeded" : "other";
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

function buildGuestReminderBody(eventKey: ShortletReminderEventKey) {
  if (eventKey === "checkin_48h") return "Your check-in is in 48 hours.";
  if (eventKey === "checkin_24h") return "Your check-in is tomorrow.";
  if (eventKey === "checkin_3h") return "Arrival is coming up soon.";
  return "Checkout is today.";
}

function buildGuestReminderTitle(eventKey: ShortletReminderEventKey, title: string) {
  if (eventKey === "checkin_48h") return `Check-in in 48 hours: ${title}`;
  if (eventKey === "checkin_24h") return `Check-in tomorrow: ${title}`;
  if (eventKey === "checkin_3h") return `Arrival soon: ${title}`;
  return `Checkout today: ${title}`;
}

async function resolveUserEmail(
  client: ReturnType<typeof createServiceRoleClient>,
  userId: string
) {
  try {
    const { data } = await client.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

async function reserveReminderEvent(input: {
  client: UntypedAdminClient;
  bookingId: string;
  eventKey: ShortletReminderEventKey;
}) {
  const { error } = await input.client
    .from("shortlet_reminder_events")
    .insert({ booking_id: input.bookingId, event_key: input.eventKey });
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
  throw new Error(errorMessage || "Unable to reserve reminder event");
}

export async function postShortletSendRemindersResponse(
  request: NextRequest,
  deps: InternalReminderDeps = defaultDeps
) {
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }
  const expectedSecret = deps.getCronSecret();
  if (!hasValidCronSecret(request, expectedSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = deps.createServiceRoleClient();
  const adminClient = client as unknown as UntypedAdminClient;
  const now = deps.now();
  const todayKey = toDateKey(new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  )));
  const next8Days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  next8Days.setUTCDate(next8Days.getUTCDate() + 8);
  const next8DaysKey = toDateKey(next8Days);
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = toDateKey(yesterday);

  const { data: bookingRows, error: bookingError } = await adminClient
    .from("shortlet_bookings")
    .select(
      "id,property_id,guest_user_id,host_user_id,check_in,check_out,nights,status,total_amount_minor,currency,properties!inner(title,city,shortlet_settings(booking_mode))"
    )
    .in("status", ["pending", "confirmed"])
    .lte("check_in", next8DaysKey)
    .gte("check_out", yesterdayKey)
    .order("check_in", { ascending: true })
    .range(0, 599);

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message || "Unable to load bookings" }, { status: 500 });
  }

  const candidates = (((bookingRows as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => {
      const relation = row.properties as
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | null
        | undefined;
      const property = Array.isArray(relation) ? (relation[0] ?? null) : relation ?? null;
      const status = String(row.status || "").trim().toLowerCase();
      if (status !== "pending" && status !== "confirmed") return null;
      return {
        bookingId: String(row.id || ""),
        propertyId: String(row.property_id || ""),
        hostUserId: String(row.host_user_id || ""),
        guestUserId: String(row.guest_user_id || ""),
        propertyTitle: typeof property?.title === "string" ? property.title : "Shortlet listing",
        city: typeof property?.city === "string" ? property.city : null,
        checkIn: String(row.check_in || ""),
        checkOut: String(row.check_out || ""),
        nights: Math.max(0, Math.trunc(Number(row.nights || 0))),
        amountMinor: Math.max(0, Math.trunc(Number(row.total_amount_minor || 0))),
        currency: String(row.currency || "NGN"),
        bookingStatus: status,
      } as ShortletReminderBookingCandidate;
    })
    .filter((row): row is ShortletReminderBookingCandidate => !!row && !!row.bookingId));

  if (!candidates.length) {
    return NextResponse.json({
      ok: true,
      route: routeLabel,
      scanned: 0,
      due: 0,
      sent: 0,
      skippedAlreadySent: 0,
      errors: [],
    });
  }

  const bookingIds = candidates.map((row) => row.bookingId);
  let paymentResult = await adminClient
    .from("shortlet_payments")
    .select("booking_id,status,updated_at,created_at")
    .in("booking_id", bookingIds)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, Math.max(bookingIds.length * 3, 120) - 1);
  if (
    paymentResult.error &&
    String(paymentResult.error.message || "").toLowerCase().includes("updated_at")
  ) {
    paymentResult = await adminClient
      .from("shortlet_payments")
      .select("booking_id,status,created_at")
      .in("booking_id", bookingIds)
      .order("created_at", { ascending: false })
      .range(0, Math.max(bookingIds.length * 3, 120) - 1);
  }
  if (paymentResult.error) {
    return NextResponse.json({ error: paymentResult.error.message || "Unable to load payments" }, { status: 500 });
  }

  const latestPaymentStatusByBookingId = new Map<string, ReminderPaymentStatus>();
  for (const row of ((paymentResult.data as Array<Record<string, unknown>> | null) ?? [])) {
    const bookingId = String(row.booking_id || "");
    if (!bookingId || latestPaymentStatusByBookingId.has(bookingId)) continue;
    latestPaymentStatusByBookingId.set(bookingId, normalizePaymentStatus(row.status));
  }

  const allDispatches = resolveReminderDispatches({
    candidates,
    latestPaymentStatusByBookingId,
    now,
  });

  const sentKeys = new Set<string>();
  const { data: sentRows } = await adminClient
    .from("shortlet_reminder_events")
    .select("booking_id,event_key")
    .in("booking_id", bookingIds);
  for (const row of ((sentRows as Array<Record<string, unknown>> | null) ?? [])) {
    const bookingId = String(row.booking_id || "");
    const eventKey = String(row.event_key || "");
    if (!bookingId || !eventKey) continue;
    sentKeys.add(`${bookingId}:${eventKey}`);
  }

  const dispatches = filterUnsentReminderDispatches(allDispatches, sentKeys);
  const siteUrl = await deps.getSiteUrl();
  const bookingById = new Map(candidates.map((row) => [row.bookingId, row]));
  const emailCache = new Map<string, string | null>();
  const getEmail = async (userId: string) => {
    if (emailCache.has(userId)) return emailCache.get(userId) ?? null;
    const email = await resolveUserEmail(client, userId);
    emailCache.set(userId, email);
    return email;
  };

  let sent = 0;
  let skippedAlreadySent = 0;
  const errors: string[] = [];

  for (const dispatch of dispatches) {
    const booking = bookingById.get(dispatch.bookingId);
    if (!booking) continue;
    try {
      const reserved = await reserveReminderEvent({
        client: adminClient,
        bookingId: dispatch.bookingId,
        eventKey: dispatch.eventKey,
      });
      if (reserved.duplicate) {
        skippedAlreadySent += 1;
        continue;
      }

      if (dispatch.notifyGuest) {
        const guestEmail = await getEmail(booking.guestUserId);
        if (guestEmail) {
          const emailTemplate =
            dispatch.eventKey === "checkout_morning"
              ? buildTenantCheckoutReminderEmail({
                  propertyTitle: booking.propertyTitle,
                  city: booking.city,
                  checkIn: booking.checkIn,
                  checkOut: booking.checkOut,
                  nights: booking.nights,
                  amountMinor: booking.amountMinor,
                  currency: booking.currency,
                  bookingId: booking.bookingId,
                  siteUrl,
                })
              : buildTenantCheckinReminderEmail({
                  propertyTitle: booking.propertyTitle,
                  city: booking.city,
                  checkIn: booking.checkIn,
                  checkOut: booking.checkOut,
                  nights: booking.nights,
                  amountMinor: booking.amountMinor,
                  currency: booking.currency,
                  bookingId: booking.bookingId,
                  siteUrl,
                  eventKey: dispatch.eventKey,
                });
          await deps.sendEmail(guestEmail, emailTemplate.subject, emailTemplate.html);
        }
        await deps.createNotification({
          userId: booking.guestUserId,
          type: "shortlet_booking_host_update",
          title: buildGuestReminderTitle(dispatch.eventKey, booking.propertyTitle),
          body: buildGuestReminderBody(dispatch.eventKey),
          href: `/trips/${booking.bookingId}`,
          dedupeKey: `shortlet:${booking.bookingId}:reminder:${dispatch.eventKey}:guest`,
        });
      }

      if (dispatch.notifyHost) {
        const hostEmail = await getEmail(booking.hostUserId);
        if (hostEmail) {
          const hostTemplate = buildHostCheckinHeadsUpEmail({
            propertyTitle: booking.propertyTitle,
            city: booking.city,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            nights: booking.nights,
            amountMinor: booking.amountMinor,
            currency: booking.currency,
            bookingId: booking.bookingId,
            siteUrl,
          });
          await deps.sendEmail(hostEmail, hostTemplate.subject, hostTemplate.html);
        }
        await deps.createNotification({
          userId: booking.hostUserId,
          type: "shortlet_booking_host_update",
          title: `Check-in in 24 hours: ${booking.propertyTitle}`,
          body: "Guest check-in is tomorrow. Review arrival readiness.",
          href: `/host/bookings?booking=${booking.bookingId}`,
          dedupeKey: `shortlet:${booking.bookingId}:reminder:checkin_24h:host`,
        });
      }

      sent += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "send_failed");
    }
  }

  return NextResponse.json({
    ok: true,
    route: routeLabel,
    scanned: candidates.length,
    due: dispatches.length,
    sent,
    skippedAlreadySent,
    errors,
    asOf: todayKey,
  });
}

export async function POST(request: NextRequest) {
  return postShortletSendRemindersResponse(request, defaultDeps);
}
