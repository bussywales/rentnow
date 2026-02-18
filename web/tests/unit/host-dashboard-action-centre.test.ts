import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const hostDashboardContentPath = path.join(
  process.cwd(),
  "components",
  "host",
  "HostDashboardContent.tsx"
);

void test("host action centre copy and links are present", () => {
  const contents = fs.readFileSync(hostDashboardContentPath, "utf8");
  assert.match(contents, /Action centre/);
  assert.match(contents, /Booking requests awaiting your approval/);
  assert.match(contents, /Respond within 12 hours to avoid auto-expiry\./);
  assert.match(contents, /\/host\?tab=bookings&view=awaiting#host-bookings/);
  assert.match(contents, /\/host\?tab=bookings#host-bookings/);
});

