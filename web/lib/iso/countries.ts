import { COUNTRIES } from "@/lib/countries";

export type IsoCountry = {
  code: string;
  name: string;
};

export const ISO_COUNTRIES: IsoCountry[] = COUNTRIES.map((country) => ({
  code: country.code.toUpperCase(),
  name: country.name,
}));

const ISO_COUNTRY_BY_CODE = new Map(ISO_COUNTRIES.map((country) => [country.code, country]));

// Common default currency mapping for admin policy setup convenience.
const COMMON_COUNTRY_CURRENCY_MAP: Record<string, string> = {
  AE: "AED",
  AU: "AUD",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  EG: "EGP",
  EU: "EUR",
  GB: "GBP",
  GH: "GHS",
  IN: "INR",
  JP: "JPY",
  KE: "KES",
  MA: "MAD",
  NG: "NGN",
  RW: "RWF",
  SA: "SAR",
  SL: "SLE",
  SN: "XOF",
  TZ: "TZS",
  UG: "UGX",
  US: "USD",
  ZA: "ZAR",
  ZM: "ZMW",
};

export function normalizeIsoCountryCode(value: string | null | undefined): string {
  return String(value || "").trim().toUpperCase();
}

export function findIsoCountryByCode(value: string | null | undefined): IsoCountry | null {
  const code = normalizeIsoCountryCode(value);
  if (!code) return null;
  return ISO_COUNTRY_BY_CODE.get(code) ?? null;
}

export function getCommonCurrencyForCountry(value: string | null | undefined): string | null {
  const code = normalizeIsoCountryCode(value);
  if (!code) return null;
  return COMMON_COUNTRY_CURRENCY_MAP[code] ?? null;
}

export function formatIsoCountryLabel(country: Pick<IsoCountry, "name" | "code">): string {
  return `${country.name} (${country.code})`;
}
