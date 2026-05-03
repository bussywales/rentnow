import test from "node:test";
import assert from "node:assert/strict";
import { isValidOptionalSupportEmail } from "@/components/support/SupportContactForm";

void test("support contact form accepts standard valid email addresses", () => {
  assert.equal(isValidOptionalSupportEmail("bussywales@hotmail.com"), true);
  assert.equal(isValidOptionalSupportEmail("test.user+bootcamp@example.co.uk"), true);
  assert.equal(isValidOptionalSupportEmail("  bussywales@hotmail.com  "), true);
});

void test("support contact form still rejects obviously invalid email addresses", () => {
  assert.equal(isValidOptionalSupportEmail("not-an-email"), false);
  assert.equal(isValidOptionalSupportEmail("missing-at.example.com"), false);
  assert.equal(isValidOptionalSupportEmail("missing-domain@"), false);
  assert.equal(isValidOptionalSupportEmail("missing-tld@example"), false);
});

void test("support contact form keeps email optional", () => {
  assert.equal(isValidOptionalSupportEmail(""), true);
  assert.equal(isValidOptionalSupportEmail("   "), true);
});
