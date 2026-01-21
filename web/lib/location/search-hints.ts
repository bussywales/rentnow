const POSTAL_GB_FULL = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const POSTAL_GB_OUTWARD = /^[A-Z]{1,2}\d[A-Z\d]?$/i;
const POSTAL_US = /^\d{5}(?:-\d{4})?$/;
const POSTAL_CA = /^[A-Z]\d[A-Z](?:[ -]?\d[A-Z]\d)?$/i;
const POSTAL_GENERIC = /[A-Z]\d|\d[A-Z]/i;

export type PostalKind = "GB" | "US" | "CA" | null;
export type LocationQueryType =
  | "UK_POSTCODE"
  | "US_ZIP"
  | "CA_FSA"
  | "GENERIC_POSTAL_LIKE"
  | "NONE";

function normalizeQuery(query: string): string {
  return query.trim();
}

export function classifyLocationQuery(rawQuery: string): LocationQueryType {
  const query = normalizeQuery(rawQuery);
  if (query.length < 3) return "NONE";
  if (POSTAL_US.test(query)) return "US_ZIP";
  if (POSTAL_CA.test(query)) return "CA_FSA";
  if (POSTAL_GB_FULL.test(query) || POSTAL_GB_OUTWARD.test(query)) return "UK_POSTCODE";
  if (POSTAL_GENERIC.test(query)) return "GENERIC_POSTAL_LIKE";
  return "NONE";
}

export function looksLikePostalCode(query: string): PostalKind {
  const type = classifyLocationQuery(query);
  switch (type) {
    case "UK_POSTCODE":
      return "GB";
    case "US_ZIP":
      return "US";
    case "CA_FSA":
      return "CA";
    default:
      return null;
  }
}

export function countryCodeFromQueryType(type: LocationQueryType): PostalKind {
  switch (type) {
    case "UK_POSTCODE":
      return "GB";
    case "US_ZIP":
      return "US";
    case "CA_FSA":
      return "CA";
    default:
      return null;
  }
}

export function countryNameFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code.toUpperCase()) {
    case "GB":
      return "United Kingdom";
    case "NG":
      return "Nigeria";
    case "US":
      return "United States";
    case "CA":
      return "Canada";
    default:
      return code.toUpperCase();
  }
}

export function inferCountryFromResults(
  results: Array<{ country_code?: string | null }>,
  sampleSize = 5
): string | null {
  if (!results?.length) return null;
  const sliced = results.slice(0, sampleSize);
  const codes = sliced
    .map((item) => (item.country_code ? item.country_code.toUpperCase() : null))
    .filter((code): code is string => !!code);
  if (!codes.length) return null;
  const first = codes[0];
  const allSame = codes.every((code) => code === first);
  return allSame ? first : null;
}

export function buildCountryHintKey(type: LocationQueryType, countryCode: string | null): string | null {
  if (countryCode) return `${type}-${countryCode.toUpperCase()}`;
  if (type === "GENERIC_POSTAL_LIKE") return "GENERIC_POSTAL_LIKE";
  return null;
}

export function shouldShowCountryCta(params: {
  countrySelected: boolean;
  ctaKey: string | null;
  dismissedKey: string | null;
}): boolean {
  if (!params.ctaKey) return false;
  if (params.dismissedKey && params.dismissedKey === params.ctaKey) return false;
  if (params.countrySelected) return false;
  return true;
}
