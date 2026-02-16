import { getSiteUrl } from "@/lib/env";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  buildHostBookingApprovedEmail,
  buildHostNewBookingRequestEmail,
  buildHostNewReservationEmail,
  buildTenantBookingApprovedEmail,
  buildTenantBookingDeclinedEmail,
  buildTenantBookingExpiredEmail,
  buildTenantBookingRequestSentEmail,
  buildTenantReservationConfirmedEmail,
} from "@/lib/email/templates/shortlet-bookings";

type NotificationPayload = {
  propertyTitle: string;
  city?: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  amountMinor: number;
  currency: string;
  bookingId: string;
};

type ShortletNotificationEventType =
  | "host_new_booking_request"
  | "tenant_booking_request_sent"
  | "host_new_reservation"
  | "tenant_reservation_confirmed"
  | "tenant_booking_approved"
  | "host_booking_approved_confirmation"
  | "tenant_booking_declined"
  | "tenant_booking_expired";

type ShortletNotificationDispatchInput = {
  eventType: ShortletNotificationEventType;
  recipientUserId: string | null;
  recipientEmail: string | null;
  payload: NotificationPayload;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

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

type NotificationRow = {
  booking_id: string;
  event_type: ShortletNotificationEventType;
  recipient_user_id: string;
  recipient_email: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
};

type NotificationClient = {
  from: (table: "shortlet_booking_notifications") => {
    insert: (
      row: NotificationRow
    ) => Promise<{ error: { code?: string | null; message?: string | null } | null }>;
    update: (
      row: Partial<NotificationRow> & { sent_at?: string | null; updated_at?: string }
    ) => {
      eq: (column: "booking_id", value: string) => {
        eq: (
          column: "event_type",
          value: ShortletNotificationEventType
        ) => {
          eq: (column: "recipient_user_id", value: string) => Promise<{ error: { message?: string } | null }>;
        };
      };
    };
  };
};

function shortletEmailsEnabled() {
  return process.env.SHORTLET_BOOKING_EMAILS_ENABLED !== "false";
}

async function buildBaseInput(payload: NotificationPayload) {
  const siteUrl = await getSiteUrl();
  return {
    ...payload,
    siteUrl,
  };
}

function mapEventToEmail(
  eventType: ShortletNotificationEventType,
  base: Awaited<ReturnType<typeof buildBaseInput>>
) {
  if (eventType === "host_new_booking_request") return buildHostNewBookingRequestEmail(base);
  if (eventType === "tenant_booking_request_sent") return buildTenantBookingRequestSentEmail(base);
  if (eventType === "host_new_reservation") return buildHostNewReservationEmail(base);
  if (eventType === "tenant_reservation_confirmed") return buildTenantReservationConfirmedEmail(base);
  if (eventType === "tenant_booking_approved") return buildTenantBookingApprovedEmail(base);
  if (eventType === "host_booking_approved_confirmation") return buildHostBookingApprovedEmail(base);
  if (eventType === "tenant_booking_declined") return buildTenantBookingDeclinedEmail(base);
  return buildTenantBookingExpiredEmail(base);
}

async function reserveNotificationEvent(
  client: NotificationClient,
  input: {
    bookingId: string;
    eventType: ShortletNotificationEventType;
    recipientUserId: string;
    recipientEmail: string;
  }
) {
  const { error } = await client.from("shortlet_booking_notifications").insert({
    booking_id: input.bookingId,
    event_type: input.eventType,
    recipient_user_id: input.recipientUserId,
    recipient_email: input.recipientEmail,
    status: "pending",
    error: null,
  });

  if (!error) return { duplicate: false };
  if (error.code === "23505") return { duplicate: true };
  throw new Error(error.message || "Unable to reserve shortlet notification event");
}

async function finalizeNotificationEvent(
  client: NotificationClient,
  input: {
    bookingId: string;
    eventType: ShortletNotificationEventType;
    recipientUserId: string;
    status: "sent" | "failed";
    error: string | null;
  }
) {
  await client
    .from("shortlet_booking_notifications")
    .update({
      status: input.status,
      error: input.error,
      sent_at: input.status === "sent" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("booking_id", input.bookingId)
    .eq("event_type", input.eventType)
    .eq("recipient_user_id", input.recipientUserId);
}

export type ShortletNotificationDispatchDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  sendEmail: typeof sendEmail;
};

const defaultDispatchDeps: ShortletNotificationDispatchDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  sendEmail,
};

export async function dispatchShortletNotificationEvent(
  input: ShortletNotificationDispatchInput,
  deps: ShortletNotificationDispatchDeps = defaultDispatchDeps
) {
  if (!shortletEmailsEnabled()) return;
  if (!input.recipientEmail || !input.recipientUserId) return;
  if (!deps.hasServiceRoleEnv()) return;

  const adminClient = deps.createServiceRoleClient() as unknown as NotificationClient;
  const reservation = await reserveNotificationEvent(adminClient, {
    bookingId: input.payload.bookingId,
    eventType: input.eventType,
    recipientUserId: input.recipientUserId,
    recipientEmail: input.recipientEmail,
  });
  if (reservation.duplicate) return;

  const base = await buildBaseInput(input.payload);
  const { subject, html } = mapEventToEmail(input.eventType, base);
  const sent = await deps.sendEmail(input.recipientEmail, subject, html);

  await finalizeNotificationEvent(adminClient, {
    bookingId: input.payload.bookingId,
    eventType: input.eventType,
    recipientUserId: input.recipientUserId,
    status: sent.ok ? "sent" : "failed",
    error: sent.ok ? null : "send_failed",
  });
}

export async function notifyHostNewBookingRequest(input: {
  hostUserId: string | null;
  email: string | null;
  payload: NotificationPayload;
}) {
  await dispatchShortletNotificationEvent({
    eventType: "host_new_booking_request",
    recipientUserId: input.hostUserId,
    recipientEmail: input.email,
    payload: input.payload,
  });
}

export async function notifyTenantBookingRequestSent(input: {
  guestUserId: string | null;
  email: string | null;
  payload: NotificationPayload;
}) {
  await dispatchShortletNotificationEvent({
    eventType: "tenant_booking_request_sent",
    recipientUserId: input.guestUserId,
    recipientEmail: input.email,
    payload: input.payload,
  });
}

export async function notifyHostNewReservation(input: {
  hostUserId: string | null;
  email: string | null;
  payload: NotificationPayload;
}) {
  await dispatchShortletNotificationEvent({
    eventType: "host_new_reservation",
    recipientUserId: input.hostUserId,
    recipientEmail: input.email,
    payload: input.payload,
  });
}

export async function notifyTenantReservationConfirmed(input: {
  guestUserId: string | null;
  email: string | null;
  payload: NotificationPayload;
}) {
  await dispatchShortletNotificationEvent({
    eventType: "tenant_reservation_confirmed",
    recipientUserId: input.guestUserId,
    recipientEmail: input.email,
    payload: input.payload,
  });
}

export async function notifyTenantBookingApproved(input: {
  guestUserId: string | null;
  email: string | null;
  payload: NotificationPayload;
}) {
  await dispatchShortletNotificationEvent({
    eventType: "tenant_booking_approved",
    recipientUserId: input.guestUserId,
    recipientEmail: input.email,
    payload: input.payload,
  });
}

export async function notifyHostBookingApprovedConfirmation(input: {
  hostUserId: string | null;
  email: string | null;
  payload: NotificationPayload;
}) {
  await dispatchShortletNotificationEvent({
    eventType: "host_booking_approved_confirmation",
    recipientUserId: input.hostUserId,
    recipientEmail: input.email,
    payload: input.payload,
  });
}

export async function notifyTenantBookingDeclined(input: {
  guestUserId: string | null;
  email: string | null;
  payload: NotificationPayload;
}) {
  await dispatchShortletNotificationEvent({
    eventType: "tenant_booking_declined",
    recipientUserId: input.guestUserId,
    recipientEmail: input.email,
    payload: input.payload,
  });
}

export async function notifyTenantBookingExpired(input: {
  guestUserId: string | null;
  email: string | null;
  payload: NotificationPayload;
}) {
  await dispatchShortletNotificationEvent({
    eventType: "tenant_booking_expired",
    recipientUserId: input.guestUserId,
    recipientEmail: input.email,
    payload: input.payload,
  });
}
