import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeJurisdictionPolicyCodes,
  validateJurisdictionPolicyCodes,
} from "@/lib/referrals/jurisdiction-policy-validation";

void test("normalizeJurisdictionPolicyCodes uppercases and trims values", () => {
  const normalized = normalizeJurisdictionPolicyCodes({
    country_code: " ng ",
    currency: " ngn ",
  });

  assert.equal(normalized.country_code, "NG");
  assert.equal(normalized.currency, "NGN");
});

void test("validateJurisdictionPolicyCodes returns errors for missing values", () => {
  const result = validateJurisdictionPolicyCodes({
    country_code: "",
    currency: "",
  });

  assert.equal(result.country_code, "Select a country.");
  assert.equal(result.currency, "Select a currency.");
});

void test("validateJurisdictionPolicyCodes rejects unknown ISO codes", () => {
  const result = validateJurisdictionPolicyCodes({
    country_code: "ZZ",
    currency: "ZZZ",
  });

  assert.equal(result.country_code, "Select a valid ISO country.");
  assert.equal(result.currency, "Select a valid ISO currency.");
});

void test("validateJurisdictionPolicyCodes accepts valid ISO codes", () => {
  const result = validateJurisdictionPolicyCodes({
    country_code: "NG",
    currency: "NGN",
  });

  assert.equal(result.country_code, undefined);
  assert.equal(result.currency, undefined);
});
