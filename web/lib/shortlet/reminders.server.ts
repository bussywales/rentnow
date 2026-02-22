export type ShortletReminderEventKey =
  | "checkin_48h"
  | "checkin_24h"
  | "checkin_3h"
  | "checkout_morning"
  | "manual_checkin_shared";

export type ReminderPaymentStatus = "succeeded" | "other";

export type ShortletReminderBookingCandidate = {
  bookingId: string;
  propertyId: string;
  hostUserId: string;
  guestUserId: string;
  propertyTitle: string;
  city: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  amountMinor: number;
  currency: string;
  bookingStatus: "pending" | "confirmed";
};

export type ShortletReminderDispatch = {
  bookingId: string;
  eventKey: Exclude<ShortletReminderEventKey, "manual_checkin_shared">;
  notifyGuest: boolean;
  notifyHost: boolean;
};

const DEFAULT_CHECKIN_HOUR = 15;
const DEFAULT_CHECKOUT_MORNING_HOUR = 8;
const EVENT_CATCHUP_WINDOW_MS = 26 * 60 * 60 * 1000;

function parseDateOnly(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function addHours(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

function toCheckinDateTime(checkInDate: string) {
  const parsed = parseDateOnly(checkInDate);
  if (!parsed) return null;
  parsed.setUTCHours(DEFAULT_CHECKIN_HOUR, 0, 0, 0);
  return parsed;
}

function toCheckoutMorningDateTime(checkOutDate: string) {
  const parsed = parseDateOnly(checkOutDate);
  if (!parsed) return null;
  parsed.setUTCHours(DEFAULT_CHECKOUT_MORNING_HOUR, 0, 0, 0);
  return parsed;
}

function isDueEvent(eventAt: Date | null, now: Date) {
  if (!eventAt) return false;
  const nowMs = now.getTime();
  const eventMs = eventAt.getTime();
  return eventMs <= nowMs && nowMs - eventMs <= EVENT_CATCHUP_WINDOW_MS;
}

export function resolveReminderDispatches(input: {
  candidates: ShortletReminderBookingCandidate[];
  latestPaymentStatusByBookingId: Map<string, ReminderPaymentStatus>;
  now: Date;
}) {
  const dispatches: ShortletReminderDispatch[] = [];
  for (const booking of input.candidates) {
    const paymentStatus = input.latestPaymentStatusByBookingId.get(booking.bookingId) ?? "other";
    if (paymentStatus !== "succeeded") continue;
    if (booking.bookingStatus !== "confirmed" && booking.bookingStatus !== "pending") continue;

    const checkInAt = toCheckinDateTime(booking.checkIn);
    const checkoutMorningAt = toCheckoutMorningDateTime(booking.checkOut);
    if (isDueEvent(addHours(checkInAt, -48), input.now)) {
      dispatches.push({
        bookingId: booking.bookingId,
        eventKey: "checkin_48h",
        notifyGuest: true,
        notifyHost: false,
      });
    }
    if (isDueEvent(addHours(checkInAt, -24), input.now)) {
      dispatches.push({
        bookingId: booking.bookingId,
        eventKey: "checkin_24h",
        notifyGuest: true,
        notifyHost: true,
      });
    }
    if (isDueEvent(addHours(checkInAt, -3), input.now)) {
      dispatches.push({
        bookingId: booking.bookingId,
        eventKey: "checkin_3h",
        notifyGuest: true,
        notifyHost: false,
      });
    }
    if (isDueEvent(checkoutMorningAt, input.now)) {
      dispatches.push({
        bookingId: booking.bookingId,
        eventKey: "checkout_morning",
        notifyGuest: true,
        notifyHost: false,
      });
    }
  }
  return dispatches;
}

export function filterUnsentReminderDispatches(
  dispatches: ShortletReminderDispatch[],
  sentKeys: Set<string>
) {
  return dispatches.filter((dispatch) => !sentKeys.has(`${dispatch.bookingId}:${dispatch.eventKey}`));
}
