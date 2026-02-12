import { normalizeCurrency } from "@/lib/currencies";

export const MARKET_COOKIE_NAME = "ph_market";

export type MarketSource = "cookie" | "geo" | "default";

export type ResolvedMarket = {
  country: string;
  currency: string;
  source: MarketSource;
};

export type MarketSettings = {
  defaultCountry: string;
  defaultCurrency: string;
  autoDetectEnabled: boolean;
  selectorEnabled: boolean;
};

export type MarketOption = {
  country: string;
  currency: string;
  label: string;
};

export const DEFAULT_MARKET_SETTINGS: MarketSettings = {
  defaultCountry: "NG",
  defaultCurrency: "NGN",
  autoDetectEnabled: true,
  selectorEnabled: true,
};

export const MARKET_OPTIONS: MarketOption[] = [
  { country: "NG", currency: "NGN", label: "Nigeria" },
  { country: "GB", currency: "GBP", label: "United Kingdom" },
];

const MARKET_COUNTRY_TO_CURRENCY = new Map(
  MARKET_OPTIONS.map((option) => [option.country, option.currency])
);

const GEO_HEADERS = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "x-country",
  "x-geo-country",
  "x-country-code",
] as const;

type HeaderBag = Headers | Record<string, string | null | undefined>;

function normalizeCountryCode(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  return normalized;
}

function normalizeCurrencyCode(input: string | null | undefined): string | null {
  return normalizeCurrency(input ?? null);
}

function resolveHeaderValue(headers: HeaderBag | null | undefined, key: string): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) {
    const value = headers.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  const direct = headers[key];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const lowerKey = key.toLowerCase();
  for (const [candidateKey, candidateValue] of Object.entries(headers)) {
    if (candidateKey.toLowerCase() !== lowerKey) continue;
    if (typeof candidateValue === "string" && candidateValue.trim()) {
      return candidateValue.trim();
    }
  }
  return null;
}

export function readCookieValueFromHeader(cookieHeader: string | null, key: string): string | null {
  if (!cookieHeader) return null;
  const chunks = cookieHeader.split(";");
  for (const chunk of chunks) {
    const [rawName, ...rest] = chunk.split("=");
    if (!rawName) continue;
    if (rawName.trim() !== key) continue;
    const rawValue = rest.join("=").trim();
    if (!rawValue) return null;
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}

function parseMarketCookieValue(raw: string | null | undefined): { country: string; currency: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes("|")) {
    const [countryRaw, currencyRaw] = trimmed.split("|");
    const country = normalizeCountryCode(countryRaw);
    const currency = normalizeCurrencyCode(currencyRaw);
    if (!country || !currency) return null;
    return { country, currency };
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed) as { country?: unknown; currency?: unknown };
      const country = normalizeCountryCode(typeof parsed.country === "string" ? parsed.country : null);
      const currency = normalizeCurrencyCode(
        typeof parsed.currency === "string" ? parsed.currency : null
      );
      if (!country || !currency) return null;
      return { country, currency };
    } catch {
      return null;
    }
  }
  return null;
}

function isSupportedCountry(countryCode: string, settings: MarketSettings): boolean {
  if (countryCode === settings.defaultCountry) return true;
  return MARKET_COUNTRY_TO_CURRENCY.has(countryCode);
}

function resolveCurrencyForCountry(countryCode: string, settings: MarketSettings): string {
  return MARKET_COUNTRY_TO_CURRENCY.get(countryCode) ?? settings.defaultCurrency;
}

function detectCountryFromHeaders(headers: HeaderBag | null | undefined): string | null {
  for (const header of GEO_HEADERS) {
    const value = resolveHeaderValue(headers, header);
    const normalized = normalizeCountryCode(value);
    if (normalized) return normalized;
  }
  return null;
}

function withDefaults(input?: Partial<MarketSettings> | null): MarketSettings {
  const defaultCountry =
    normalizeCountryCode(input?.defaultCountry ?? null) ?? DEFAULT_MARKET_SETTINGS.defaultCountry;
  const defaultCurrency =
    normalizeCurrencyCode(input?.defaultCurrency ?? null) ?? DEFAULT_MARKET_SETTINGS.defaultCurrency;
  return {
    defaultCountry,
    defaultCurrency,
    autoDetectEnabled:
      typeof input?.autoDetectEnabled === "boolean"
        ? input.autoDetectEnabled
        : DEFAULT_MARKET_SETTINGS.autoDetectEnabled,
    selectorEnabled:
      typeof input?.selectorEnabled === "boolean"
        ? input.selectorEnabled
        : DEFAULT_MARKET_SETTINGS.selectorEnabled,
  };
}

export function serializeMarketCookieValue(country: string, currency: string): string {
  const safeCountry = normalizeCountryCode(country) ?? DEFAULT_MARKET_SETTINGS.defaultCountry;
  const safeCurrency = normalizeCurrencyCode(currency) ?? DEFAULT_MARKET_SETTINGS.defaultCurrency;
  return `${safeCountry}|${safeCurrency}`;
}

export function resolveMarketFromRequest(input: {
  headers?: HeaderBag | null;
  cookieValue?: string | null;
  appSettings?: Partial<MarketSettings> | null;
}): ResolvedMarket {
  const settings = withDefaults(input.appSettings);
  const cookieHeader = resolveHeaderValue(input.headers ?? null, "cookie");
  const preferredCookie = parseMarketCookieValue(
    input.cookieValue ?? readCookieValueFromHeader(cookieHeader, MARKET_COOKIE_NAME)
  );

  if (
    preferredCookie &&
    isSupportedCountry(preferredCookie.country, settings) &&
    normalizeCurrencyCode(preferredCookie.currency)
  ) {
    return {
      country: preferredCookie.country,
      currency: preferredCookie.currency,
      source: "cookie",
    };
  }

  if (settings.autoDetectEnabled) {
    const geoCountry = detectCountryFromHeaders(input.headers ?? null);
    if (geoCountry && isSupportedCountry(geoCountry, settings)) {
      return {
        country: geoCountry,
        currency: resolveCurrencyForCountry(geoCountry, settings),
        source: "geo",
      };
    }
  }

  return {
    country: settings.defaultCountry,
    currency: settings.defaultCurrency,
    source: "default",
  };
}

export function formatCurrencySymbol(currency: string | null | undefined): string {
  const code = normalizeCurrencyCode(currency ?? null);
  if (code === "NGN") return "\u20A6";
  if (code === "GBP") return "\u00A3";
  if (code === "USD") return "$";
  if (code === "EUR") return "\u20AC";
  return code ?? DEFAULT_MARKET_SETTINGS.defaultCurrency;
}

export function formatMarketLabel(market: { country: string; currency: string }): string {
  const option = MARKET_OPTIONS.find(
    (entry) => entry.country === market.country && entry.currency === market.currency
  );
  const symbol = formatCurrencySymbol(market.currency);
  if (option) return `${option.label} (${symbol})`;
  return `${market.country} (${symbol})`;
}
