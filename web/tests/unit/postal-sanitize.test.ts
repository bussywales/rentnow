import test from "node:test";
import assert from "node:assert/strict";
import { sanitizePostalCode } from "@/lib/geocode/normalize-location";

void test("sanitizes mixed postal codes for GB", () => {
  assert.equal(sanitizePostalCode("GB", "ST4 7QB, 101233"), "ST4 7QB");
});

void test("formats GB outward/inward spacing", () => {
  assert.equal(sanitizePostalCode("GB", "st47qb"), "ST4 7QB");
});

void test("formats CA postal codes with spacing", () => {
  assert.equal(sanitizePostalCode("CA", "m5v2t6"), "M5V 2T6");
});

void test("keeps US ZIP+4", () => {
  assert.equal(sanitizePostalCode("US", "94105-1234"), "94105-1234");
});
