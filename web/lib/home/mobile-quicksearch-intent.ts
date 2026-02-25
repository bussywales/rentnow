export type MobileQuickSearchIntent = "shortlet" | "rent" | "buy";

const STORAGE_KEY_PREFIX = "mobile_quicksearch_intent_v2";

const MARKET_DEFAULT_INTENTS: Record<string, MobileQuickSearchIntent> = {
  NG: "shortlet",
  UK: "rent",
  GB: "rent",
  CA: "rent",
  US: "rent",
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeMarketCountry(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (!normalized) return "GLOBAL";
  if (normalized === "GB") return "UK";
  return normalized;
}

function storageKeyForMarket(marketCountry: string): string {
  return `${STORAGE_KEY_PREFIX}:${normalizeMarketCountry(marketCountry)}`;
}

function normalizeIntent(value: string | null | undefined): MobileQuickSearchIntent | null {
  if (value === "shortlet" || value === "rent" || value === "buy") return value;
  return null;
}

export function getDefaultIntentForMarket(marketCountry: string): MobileQuickSearchIntent {
  const normalizedMarket = normalizeMarketCountry(marketCountry);
  return MARKET_DEFAULT_INTENTS[normalizedMarket] ?? "rent";
}

export function readStoredIntentForMarket(marketCountry: string): MobileQuickSearchIntent | null {
  if (!isBrowser()) return null;
  const key = storageKeyForMarket(marketCountry);
  try {
    return normalizeIntent(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function writeStoredIntentForMarket(
  marketCountry: string,
  intent: MobileQuickSearchIntent
): void {
  if (!isBrowser()) return;
  const key = storageKeyForMarket(marketCountry);
  try {
    window.localStorage.setItem(key, intent);
  } catch {
    // Ignore write errors in private mode/quota constrained browsers.
  }
}

export function resolveIntentForMarket(marketCountry: string): MobileQuickSearchIntent {
  return readStoredIntentForMarket(marketCountry) ?? getDefaultIntentForMarket(marketCountry);
}
