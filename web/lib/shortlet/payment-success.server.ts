import { createNotification, buildShortletNotificationBody } from "@/lib/notifications/notifications.server";
import {
  notifyHostNewBookingRequest,
  notifyHostNewReservation,
  notifyTenantBookingRequestSent,
  notifyTenantReservationConfirmed,
} from "@/lib/shortlet/notifications.server";
import { ensureShortletPayoutForBooking } from "@/lib/shortlet/shortlet.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

export type ShortletPaymentSuccessDispatchInput = {
  bookingId: string;
  propertyId: string;
  hostUserId: string;
  guestUserId: string;
  listingTitle: string | null;
  city: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  amountMinor: number;
  currency: string;
  bookingStatus: "pending" | "confirmed" | "completed";
};

async function resolveUserEmail(userId: string): Promise<string | null> {
  if (!hasServiceRoleEnv()) return null;
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function dispatchShortletPaymentSuccess(input: ShortletPaymentSuccessDispatchInput) {
  const payload = {
    propertyTitle: input.listingTitle || "Shortlet listing",
    city: input.city,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights: input.nights,
    amountMinor: input.amountMinor,
    currency: input.currency,
    bookingId: input.bookingId,
  };
  const body = buildShortletNotificationBody({
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights: input.nights,
    amountMinor: input.amountMinor,
    currency: input.currency,
  });

  const [guestEmail, hostEmail] = await Promise.all([
    resolveUserEmail(input.guestUserId),
    resolveUserEmail(input.hostUserId),
  ]);

  if (input.bookingStatus === "confirmed" || input.bookingStatus === "completed") {
    if (hasServiceRoleEnv()) {
      const adminClient = createServiceRoleClient();
      await ensureShortletPayoutForBooking({
        client: adminClient,
        bookingId: input.bookingId,
        hostUserId: input.hostUserId,
        amountMinor: input.amountMinor,
        currency: input.currency,
      });
    }

    await Promise.all([
      notifyTenantReservationConfirmed({
        guestUserId: input.guestUserId,
        email: guestEmail,
        payload,
      }),
      notifyHostNewReservation({
        hostUserId: input.hostUserId,
        email: hostEmail,
        payload,
      }),
      createNotification({
        userId: input.guestUserId,
        type: "shortlet_booking_instant_confirmed",
        title: "Reservation confirmed",
        body,
        href: `/trips/${input.bookingId}`,
        dedupeKey: `shortlet_booking:${input.bookingId}:instant_confirmed:tenant`,
      }),
      createNotification({
        userId: input.hostUserId,
        type: "shortlet_booking_instant_confirmed",
        title: `New reservation: ${input.listingTitle || "Shortlet listing"}`,
        body,
        href: `/host/bookings?booking=${input.bookingId}#host-bookings`,
        dedupeKey: `shortlet_booking:${input.bookingId}:instant_confirmed:host`,
      }),
    ]);

    return;
  }

  await Promise.all([
    notifyTenantBookingRequestSent({
      guestUserId: input.guestUserId,
      email: guestEmail,
      payload,
    }),
    notifyHostNewBookingRequest({
      hostUserId: input.hostUserId,
      email: hostEmail,
      payload,
    }),
    createNotification({
      userId: input.guestUserId,
      type: "shortlet_booking_request_sent",
      title: "Your booking request was sent",
      body,
      href: `/trips/${input.bookingId}`,
      dedupeKey: `shortlet_booking:${input.bookingId}:request_sent:tenant`,
    }),
    createNotification({
      userId: input.hostUserId,
      type: "shortlet_booking_request_sent",
      title: `New booking request: ${input.listingTitle || "Shortlet listing"}`,
      body,
      href: `/host/bookings?booking=${input.bookingId}#host-bookings`,
      dedupeKey: `shortlet_booking:${input.bookingId}:request_sent:host`,
    }),
  ]);
}
