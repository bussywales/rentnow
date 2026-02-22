import {
  expandRangesToDisabledDates,
  type ShortletUnavailableRange,
} from "@/lib/shortlet/availability";

export type HostCalendarBlockRow = {
  id: string;
  property_id: string;
  date_from: string;
  date_to: string;
  reason: string | null;
};

export type HostCalendarBookingRow = {
  id: string;
  property_id: string;
  check_in: string;
  check_out: string;
  status: string;
};

const BOOKING_BLOCKING_STATUSES = new Set(["pending", "confirmed", "completed"]);

export function buildHostCalendarAvailability(input: {
  propertyId: string;
  blocks: HostCalendarBlockRow[];
  bookings: HostCalendarBookingRow[];
}) {
  const blockedRanges: ShortletUnavailableRange[] = input.blocks
    .filter((row) => row.property_id === input.propertyId)
    .map((row) => ({
      start: row.date_from,
      end: row.date_to,
      source: "host_block",
    }));

  const bookedRanges: ShortletUnavailableRange[] = input.bookings
    .filter(
      (row) =>
        row.property_id === input.propertyId &&
        BOOKING_BLOCKING_STATUSES.has(String(row.status || "").toLowerCase())
    )
    .map((row) => ({
      start: row.check_in,
      end: row.check_out,
      source: "booking",
      bookingId: row.id,
    }));

  const blockedDateSet = expandRangesToDisabledDates(blockedRanges);
  const bookedDateSet = expandRangesToDisabledDates(bookedRanges);

  return {
    blockedRanges,
    bookedRanges,
    blockedDateSet,
    bookedDateSet,
  };
}
