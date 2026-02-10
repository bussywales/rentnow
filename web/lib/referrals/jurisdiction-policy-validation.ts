import {
  findIsoCountryByCode,
  normalizeIsoCountryCode,
} from "@/lib/iso/countries";
import {
  findIsoCurrencyByCode,
  normalizeIsoCurrencyCode,
} from "@/lib/iso/currencies";
import type { ReferralCashoutRateMode } from "@/lib/referrals/cashout";

export type JurisdictionPolicyCodeErrors = {
  country_code?: string;
  currency?: string;
};

export function normalizeJurisdictionPolicyCodes(input: {
  country_code: string | null | undefined;
  currency: string | null | undefined;
}) {
  return {
    country_code: normalizeIsoCountryCode(input.country_code),
    currency: normalizeIsoCurrencyCode(input.currency),
  };
}

export function validateJurisdictionPolicyCodes(input: {
  country_code: string | null | undefined;
  currency: string | null | undefined;
}): JurisdictionPolicyCodeErrors {
  const normalized = normalizeJurisdictionPolicyCodes(input);
  const issues: JurisdictionPolicyCodeErrors = {};

  if (!normalized.country_code) {
    issues.country_code = "Select a country.";
  } else if (!findIsoCountryByCode(normalized.country_code)) {
    issues.country_code = "Select a valid ISO country.";
  }

  if (!normalized.currency) {
    issues.currency = "Select a currency.";
  } else if (!findIsoCurrencyByCode(normalized.currency)) {
    issues.currency = "Select a valid ISO currency.";
  }

  return issues;
}

export function validatePercentModePaygAnchor(input: {
  cashout_rate_mode: ReferralCashoutRateMode;
  paygListingFeeAmount: number | null | undefined;
}): string | null {
  if (input.cashout_rate_mode !== "percent_of_payg") return null;
  const paygListingFeeAmount = Math.max(0, Number(input.paygListingFeeAmount || 0));
  if (paygListingFeeAmount > 0) return null;
  return "Set PAYG listing fee to use percent mode.";
}
