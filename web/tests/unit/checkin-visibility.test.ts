import test from "node:test";
import assert from "node:assert/strict";
import { resolveGuestCheckinVisibility } from "@/lib/shortlet/checkin-visibility";

void test("payment not succeeded hides check-in details", () => {
  const visibility = resolveGuestCheckinVisibility({
    bookingStatus: "pending_payment",
    paymentStatus: "pending",
  });
  assert.deepEqual(visibility, { canShow: false, level: "none" });
});

void test("paid pending booking shows limited check-in details", () => {
  const visibility = resolveGuestCheckinVisibility({
    bookingStatus: "pending",
    paymentStatus: "succeeded",
  });
  assert.deepEqual(visibility, { canShow: true, level: "limited" });
});

void test("paid confirmed booking shows full check-in details", () => {
  const visibility = resolveGuestCheckinVisibility({
    bookingStatus: "confirmed",
    paymentStatus: "succeeded",
  });
  assert.deepEqual(visibility, { canShow: true, level: "full" });
});
