import test from "node:test";
import assert from "node:assert/strict";
import { resolveShortletBookingCtaLabel } from "../../lib/shortlet/booking-cta";

void test("shortlet CTA copy uses request wording for request mode", () => {
  assert.equal(resolveShortletBookingCtaLabel("request"), "Request to book");
});

void test("shortlet CTA copy uses reserve wording for instant mode", () => {
  assert.equal(resolveShortletBookingCtaLabel("instant"), "Reserve");
});
