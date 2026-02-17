import test from "node:test";
import assert from "node:assert/strict";
import {
  extractBookingIdFromShortletPaystackReference,
  resolveShortletBookingIdFromPaystackPayload,
} from "@/lib/shortlet/payments.server";

void test("extractBookingIdFromShortletPaystackReference parses uuid-form reference", () => {
  const bookingId = extractBookingIdFromShortletPaystackReference(
    "shb_ps_11111111-1111-4111-8111-111111111111_1739801234567"
  );
  assert.equal(bookingId, "11111111-1111-4111-8111-111111111111");
});

void test("extractBookingIdFromShortletPaystackReference supports 32-char compact uuid", () => {
  const bookingId = extractBookingIdFromShortletPaystackReference(
    "shb_ps_11111111111141118111111111111111_1739801234567"
  );
  assert.equal(bookingId, "11111111-1111-4111-8111-111111111111");
});

void test("resolveShortletBookingIdFromPaystackPayload prefers metadata booking_id", () => {
  const bookingId = resolveShortletBookingIdFromPaystackPayload({
    reference: "shb_ps_invalid_1739801234567",
    payload: {
      data: {
        metadata: {
          booking_id: "11111111-1111-4111-8111-111111111111",
        },
      },
    },
  });
  assert.equal(bookingId, "11111111-1111-4111-8111-111111111111");
});
