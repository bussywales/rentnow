import { getSiteUrl } from "@/lib/env";
import {
  buildGuestBookingConfirmedEmail,
  buildGuestBookingDeclinedEmail,
  buildGuestBookingExpiredEmail,
  buildGuestBookingPendingEmail,
  buildHostBookingRequestEmail,
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

async function buildBaseInput(payload: NotificationPayload) {
  const siteUrl = await getSiteUrl();
  return {
    ...payload,
    siteUrl,
  };
}

export async function notifyGuestBookingPending(email: string | null, payload: NotificationPayload) {
  if (!email) return;
  const base = await buildBaseInput(payload);
  const { subject, html } = buildGuestBookingPendingEmail(base);
  await sendEmail(email, subject, html);
}

export async function notifyGuestBookingConfirmed(email: string | null, payload: NotificationPayload) {
  if (!email) return;
  const base = await buildBaseInput(payload);
  const { subject, html } = buildGuestBookingConfirmedEmail(base);
  await sendEmail(email, subject, html);
}

export async function notifyHostBookingRequest(email: string | null, payload: NotificationPayload) {
  if (!email) return;
  const base = await buildBaseInput(payload);
  const { subject, html } = buildHostBookingRequestEmail(base);
  await sendEmail(email, subject, html);
}

export async function notifyGuestBookingDeclined(email: string | null, payload: NotificationPayload) {
  if (!email) return;
  const base = await buildBaseInput(payload);
  const { subject, html } = buildGuestBookingDeclinedEmail(base);
  await sendEmail(email, subject, html);
}

export async function notifyGuestBookingExpired(email: string | null, payload: NotificationPayload) {
  if (!email) return;
  const base = await buildBaseInput(payload);
  const { subject, html } = buildGuestBookingExpiredEmail(base);
  await sendEmail(email, subject, html);
}
