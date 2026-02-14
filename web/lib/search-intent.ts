export const INTENT_COOKIE_NAME = "ph_intent";
export const INTENT_STORAGE_KEY = "ph_intent";

export type ListingIntentMode = "rent" | "buy" | "all";

function firstCookieValue(cookieHeader: string, key: string): string | null {
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

export function parseIntent(value: string | null | undefined): ListingIntentMode | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "rent" || normalized === "rent_lease") return "rent";
  if (normalized === "buy" || normalized === "sale") return "buy";
  if (normalized === "all") return "all";
  return undefined;
}

export function resolveIntent(input: {
  urlIntent?: string | null;
  cookieIntent?: string | null;
  localIntent?: string | null;
  defaultIntent?: ListingIntentMode;
}): ListingIntentMode | undefined {
  return (
    parseIntent(input.urlIntent) ??
    parseIntent(input.cookieIntent) ??
    parseIntent(input.localIntent) ??
    parseIntent(input.defaultIntent)
  );
}

export function readIntentFromCookieHeader(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return undefined;
  return parseIntent(firstCookieValue(cookieHeader, INTENT_COOKIE_NAME));
}

export function readIntentCookieClient(): ListingIntentMode | undefined {
  if (typeof document === "undefined") return undefined;
  return readIntentFromCookieHeader(document.cookie);
}

export function readIntentStorageClient(): ListingIntentMode | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return parseIntent(window.localStorage.getItem(INTENT_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

export function getClientStoredIntent(): ListingIntentMode | undefined {
  return resolveIntent({
    cookieIntent: readIntentCookieClient(),
    localIntent: readIntentStorageClient(),
  });
}

export function setIntentPersist(intent: ListingIntentMode) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    window.localStorage.setItem(INTENT_STORAGE_KEY, intent);
  } catch {
    // Ignore storage errors in private mode or restricted environments.
  }
  document.cookie = `${INTENT_COOKIE_NAME}=${encodeURIComponent(
    intent
  )}; path=/; max-age=31536000; samesite=lax`;
}
