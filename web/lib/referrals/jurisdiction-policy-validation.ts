import {
  findIsoCountryByCode,
  normalizeIsoCountryCode,
} from "@/lib/iso/countries";
import {
  findIsoCurrencyByCode,
  normalizeIsoCurrencyCode,
} from "@/lib/iso/currencies";

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
