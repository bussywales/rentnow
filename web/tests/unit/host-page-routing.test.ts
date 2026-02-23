import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildCanonicalHostBookingsHrefFromSearchParams } from "@/lib/host/bookings-navigation";

void test("legacy /host tab=bookings query redirects to canonical /host/bookings", () => {
  const nextPath = buildCanonicalHostBookingsHrefFromSearchParams({
    tab: "bookings",
    view: "awaiting",
    booking: "6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea",
  });
  assert.equal(
    nextPath,
    "/host/bookings?view=awaiting&booking=6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea"
  );
});

void test("urgency redirect injects default awaiting view when missing", () => {
  const nextPath = buildCanonicalHostBookingsHrefFromSearchParams(
    {
      city: "Lagos",
      booking: "6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea",
    },
    { defaultView: "awaiting" }
  );
  assert.equal(
    nextPath,
    "/host/bookings?city=Lagos&booking=6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea&view=awaiting"
  );
});

void test("booking-only host links normalize to bookings route with default view", () => {
  const nextPath = buildCanonicalHostBookingsHrefFromSearchParams(
    {
      booking: "6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea",
    },
    { defaultView: "awaiting" }
  );
  assert.equal(
    nextPath,
    "/host/bookings?booking=6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea&view=awaiting"
  );
});

void test("host page redirects booking query links to canonical bookings route", () => {
  const pagePath = path.join(process.cwd(), "app", "host", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /\|\|\s*requestedBooking/);
  assert.match(source, /defaultView:\s*requestedBooking\s*\?\s*"awaiting"\s*:\s*null/);
});
