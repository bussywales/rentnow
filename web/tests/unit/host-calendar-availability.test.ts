import test from "node:test";
import assert from "node:assert/strict";
import { buildHostCalendarAvailability } from "@/lib/shortlet/host-calendar";

void test("buildHostCalendarAvailability maps blocks and booked stays into disabled sets", () => {
  const result = buildHostCalendarAvailability({
    propertyId: "p-1",
    blocks: [
      {
        id: "b-1",
        property_id: "p-1",
        date_from: "2026-03-10",
        date_to: "2026-03-12",
        reason: null,
      },
    ],
    bookings: [
      {
        id: "bk-1",
        property_id: "p-1",
        check_in: "2026-03-15",
        check_out: "2026-03-18",
        status: "confirmed",
      },
      {
        id: "bk-2",
        property_id: "p-1",
        check_in: "2026-03-20",
        check_out: "2026-03-22",
        status: "pending_payment",
      },
    ],
  });

  assert.equal(result.blockedDateSet.has("2026-03-10"), true);
  assert.equal(result.blockedDateSet.has("2026-03-11"), true);
  assert.equal(result.blockedDateSet.has("2026-03-12"), false);

  assert.equal(result.bookedDateSet.has("2026-03-15"), true);
  assert.equal(result.bookedDateSet.has("2026-03-17"), true);
  assert.equal(result.bookedDateSet.has("2026-03-18"), false);
  assert.equal(result.bookedDateSet.has("2026-03-20"), false);
});
