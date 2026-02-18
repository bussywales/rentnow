import test from "node:test";
import assert from "node:assert/strict";
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
