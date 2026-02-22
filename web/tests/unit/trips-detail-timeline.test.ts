import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(process.cwd(), "app", "trips", "[id]", "page.tsx");
const componentPath = path.join(process.cwd(), "components", "trips", "TripTimeline.tsx");

void test("trip detail page is wired to shared timeline resolver", () => {
  const contents = fs.readFileSync(pagePath, "utf8");
  assert.ok(contents.includes("resolveTripTimelineSteps"));
  assert.ok(contents.includes("resolveGuestCheckinVisibility"));
  assert.ok(contents.includes("getLatestShortletPaymentStatusForBooking"));
  assert.ok(contents.includes("getGuestShortletCheckinDetailsForBooking"));
  assert.ok(contents.includes(".from(\"shortlet_booking_notes\")"));
  assert.ok(contents.includes(".eq(\"role\", \"host\")"));
  assert.ok(contents.includes("<TripTimeline"));
  assert.ok(contents.includes("checkinVisibility.canShow ? ("));
  assert.ok(contents.includes("<TripCoordinationPanel"));
});

void test("trip timeline component exposes support and listing actions", () => {
  const contents = fs.readFileSync(componentPath, "utf8");
  assert.ok(contents.includes('data-testid="trip-timeline"'));
  assert.ok(contents.includes('data-testid="trip-status-banner"'));
  assert.ok(contents.includes("View listing"));
  assert.ok(contents.includes("props.timeline.nextActions.map"));
  assert.ok(contents.includes("Status: Pending approval"));
  assert.ok(contents.includes("Host response deadline"));
});
