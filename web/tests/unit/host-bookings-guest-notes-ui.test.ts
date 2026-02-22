import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host bookings drawer wires guest notes feed", () => {
  const filePath = path.join(
    process.cwd(),
    "components",
    "host",
    "HostShortletBookingsPanel.tsx"
  );
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("/api/shortlet/bookings/${selectedBookingId}/note"));
  assert.ok(contents.includes("/api/shortlet/bookings/${row.id}/send-checkin"));
  assert.ok(contents.includes("Guest notes"));
  assert.ok(contents.includes("Send check-in details now"));
  assert.ok(contents.includes('data-testid="host-booking-guest-notes"'));
  assert.ok(contents.includes('data-testid="host-booking-send-checkin"'));
  assert.ok(contents.includes("No guest notes yet."));
});
