import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeJurisdictionPolicyCodes,
  validatePercentModePaygAnchor,
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

void test("validatePercentModePaygAnchor requires payg fee when percent mode is selected", () => {
  const missingAnchor = validatePercentModePaygAnchor({
    cashout_rate_mode: "percent_of_payg",
    paygListingFeeAmount: 0,
  });
  assert.equal(missingAnchor, "Set PAYG listing fee to use percent mode.");

  const fixedMode = validatePercentModePaygAnchor({
    cashout_rate_mode: "fixed",
    paygListingFeeAmount: 0,
  });
  assert.equal(fixedMode, null);

  const hasAnchor = validatePercentModePaygAnchor({
    cashout_rate_mode: "percent_of_payg",
    paygListingFeeAmount: 2000,
  });
  assert.equal(hasAnchor, null);
});
