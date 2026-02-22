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
  property_title?: string | null;
  guest_name?: string | null;
  guest_user_id?: string | null;
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

export type HostCalendarAgendaBookingItem = {
  bookingId: string;
  propertyId: string;
  propertyTitle: string;
  guestLabel: string;
  status: string;
};

export type HostCalendarAgendaBlockItem = {
  blockId: string;
  propertyId: string;
  propertyTitle: string;
  reason: string | null;
};

export type HostCalendarAgenda = {
  dayIso: string;
  arrivals: HostCalendarAgendaBookingItem[];
  departures: HostCalendarAgendaBookingItem[];
  inProgress: HostCalendarAgendaBookingItem[];
  blocks: HostCalendarAgendaBlockItem[];
};

function obfuscateGuestLabel(name: string | null | undefined, fallbackId: string | null | undefined) {
  const raw = String(name || "").trim();
  if (!raw && fallbackId) {
    return `Guest ${String(fallbackId).trim().slice(0, 2) || ""}*`;
  }
  if (!raw) return "Guest";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return "Guest";
  const first = parts[0];
  const secondInitial = parts[1]?.[0];
  if (!secondInitial) return first;
  return `${first} ${secondInitial.toUpperCase()}.`;
}

export function buildAgendaForDay(input: {
  dayIso: string;
  bookings: HostCalendarBookingRow[];
  blocks: HostCalendarBlockRow[];
  propertyTitleById?: Map<string, string>;
}) {
  const agenda: HostCalendarAgenda = {
    dayIso: input.dayIso,
    arrivals: [],
    departures: [],
    inProgress: [],
    blocks: [],
  };

  for (const booking of input.bookings) {
    const bookingStatus = String(booking.status || "").toLowerCase();
    if (!BOOKING_BLOCKING_STATUSES.has(bookingStatus)) continue;
    const propertyTitle =
      (typeof booking.property_title === "string" && booking.property_title.trim()) ||
      input.propertyTitleById?.get(booking.property_id) ||
      "Shortlet listing";
    const bookingItem: HostCalendarAgendaBookingItem = {
      bookingId: booking.id,
      propertyId: booking.property_id,
      propertyTitle,
      guestLabel: obfuscateGuestLabel(booking.guest_name, booking.guest_user_id),
      status: booking.status,
    };

    if (booking.check_in === input.dayIso) {
      agenda.arrivals.push(bookingItem);
    }
    if (booking.check_out === input.dayIso) {
      agenda.departures.push(bookingItem);
    }
    if (booking.check_in < input.dayIso && booking.check_out > input.dayIso) {
      agenda.inProgress.push(bookingItem);
    }
  }

  for (const block of input.blocks) {
    if (block.date_from <= input.dayIso && block.date_to > input.dayIso) {
      agenda.blocks.push({
        blockId: block.id,
        propertyId: block.property_id,
        propertyTitle: input.propertyTitleById?.get(block.property_id) || "Shortlet listing",
        reason: block.reason,
      });
    }
  }

  agenda.arrivals.sort((a, b) => a.propertyTitle.localeCompare(b.propertyTitle));
  agenda.departures.sort((a, b) => a.propertyTitle.localeCompare(b.propertyTitle));
  agenda.inProgress.sort((a, b) => a.propertyTitle.localeCompare(b.propertyTitle));
  agenda.blocks.sort((a, b) => a.propertyTitle.localeCompare(b.propertyTitle));

  return agenda;
}
