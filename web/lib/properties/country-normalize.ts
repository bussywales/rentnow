import {
  getCountryByCode,
  getCountryByName,
  normalizeCountryCode,
} from "@/lib/countries";

type CountryInput = {
  country?: string | null;
  country_code?: string | null;
};

const normalizeOptionalString = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const normalizeCountryForCreate = (input: CountryInput) => {
  let country = normalizeOptionalString(input.country);
  let country_code = normalizeCountryCode(input.country_code);

  if (country_code && !country) {
    const match = getCountryByCode(country_code);
    if (match) {
      country = match.name;
    }
  }

  if (country && !country_code) {
    const match = getCountryByName(country);
    if (match) {
      country_code = match.code;
    }
  }

  return { country, country_code };
};

export const normalizeCountryForUpdate = (input: CountryInput) => {
  const hasCountry = typeof input.country !== "undefined";
  const hasCode = typeof input.country_code !== "undefined";

  let country = hasCountry ? normalizeOptionalString(input.country) : undefined;
  let country_code = hasCode ? normalizeCountryCode(input.country_code) : undefined;

  if (hasCountry) {
    if (country) {
      const match = getCountryByName(country);
      if (match) {
        country_code = match.code;
      } else if (hasCode) {
        country_code = country_code ?? null;
      } else {
        country_code = null;
      }
    } else {
      if (hasCode) {
        country_code = country_code ?? null;
      } else {
        country_code = null;
      }
    }
  }

  if (hasCode && country_code && !hasCountry) {
    const match = getCountryByCode(country_code);
    if (match) {
      country = match.name;
    }
  }

  return { country, country_code };
};
