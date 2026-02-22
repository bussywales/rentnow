import test from "node:test";
import assert from "node:assert/strict";
import { buildAgendaForDay } from "@/lib/shortlet/host-calendar";

void test("buildAgendaForDay classifies arrivals, departures, in-progress stays, and blocks", () => {
  const agenda = buildAgendaForDay({
    dayIso: "2026-02-22",
    bookings: [
      {
        id: "arrival-1",
        property_id: "p-1",
        property_title: "Lekki Loft",
        guest_name: "Jane Doe",
        check_in: "2026-02-22",
        check_out: "2026-02-24",
        status: "confirmed",
      },
      {
        id: "departure-1",
        property_id: "p-2",
        property_title: "Ikoyi Stay",
        guest_name: "John Smith",
        check_in: "2026-02-20",
        check_out: "2026-02-22",
        status: "confirmed",
      },
      {
        id: "in-progress-1",
        property_id: "p-3",
        property_title: "Abuja Apartment",
        guest_name: "Alex Johnson",
        check_in: "2026-02-20",
        check_out: "2026-02-25",
        status: "pending",
      },
      {
        id: "ignored-pending-payment",
        property_id: "p-4",
        property_title: "Ignored",
        guest_name: "Ignore Me",
        check_in: "2026-02-22",
        check_out: "2026-02-23",
        status: "pending_payment",
      },
    ],
    blocks: [
      {
        id: "block-1",
        property_id: "p-2",
        date_from: "2026-02-21",
        date_to: "2026-02-23",
        reason: "Maintenance",
      },
    ],
  });

  assert.deepEqual(agenda.arrivals.map((row) => row.bookingId), ["arrival-1"]);
  assert.deepEqual(agenda.departures.map((row) => row.bookingId), ["departure-1"]);
  assert.deepEqual(agenda.inProgress.map((row) => row.bookingId), ["in-progress-1"]);
  assert.deepEqual(agenda.blocks.map((row) => row.blockId), ["block-1"]);
});

void test("buildAgendaForDay obfuscates guest names to first name + initial", () => {
  const agenda = buildAgendaForDay({
    dayIso: "2026-02-22",
    bookings: [
      {
        id: "booking-1",
        property_id: "p-1",
        property_title: "Lekki Loft",
        guest_name: "Jane Doe",
        check_in: "2026-02-22",
        check_out: "2026-02-24",
        status: "confirmed",
      },
    ],
    blocks: [],
  });

  assert.equal(agenda.arrivals[0]?.guestLabel, "Jane D.");
});

