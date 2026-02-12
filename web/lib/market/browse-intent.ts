export const BROWSE_INTENT_STORAGE_KEY = "ph_last_browse_intent";
export const BROWSE_INTENT_DISMISS_SESSION_KEY = "ph_browse_continue_dismissed";

export type BrowseHubIntent = {
  country: string;
  label: string;
  href: string;
};

export type BrowseIntentState = {
  lastSearchParams?: string | null;
  lastHub?: BrowseHubIntent | null;
  lastViewedListingId?: string | null;
  lastSeenAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function getSessionStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function parseState(raw: string | null): BrowseIntentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BrowseIntentState>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.lastSeenAt !== "string" || !parsed.lastSeenAt) return null;
    return {
      lastSeenAt: parsed.lastSeenAt,
      lastSearchParams:
        typeof parsed.lastSearchParams === "string" ? parsed.lastSearchParams : null,
      lastHub:
        parsed.lastHub &&
        typeof parsed.lastHub === "object" &&
        typeof parsed.lastHub.country === "string" &&
        typeof parsed.lastHub.label === "string" &&
        typeof parsed.lastHub.href === "string"
          ? {
              country: parsed.lastHub.country,
              label: parsed.lastHub.label,
              href: parsed.lastHub.href,
            }
          : null,
      lastViewedListingId:
        typeof parsed.lastViewedListingId === "string" ? parsed.lastViewedListingId : null,
    };
  } catch {
    return null;
  }
}

function normalizeSearchParams(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("?")) return trimmed;
  if (trimmed.startsWith("/")) {
    const index = trimmed.indexOf("?");
    if (index >= 0) {
      return trimmed.slice(index);
    }
  }
  return `?${trimmed.replace(/^\?+/, "")}`;
}

export function extractSearchParamsFromHref(href: string): string | null {
  if (!href) return null;
  const index = href.indexOf("?");
  if (index < 0) return null;
  return normalizeSearchParams(href.slice(index));
}

export function getLastBrowseIntent(storage: StorageLike | null = getBrowserStorage()): BrowseIntentState | null {
  if (!storage) return null;
  return parseState(storage.getItem(BROWSE_INTENT_STORAGE_KEY));
}

export function setLastBrowseIntent(
  patch: Partial<Omit<BrowseIntentState, "lastSeenAt">>,
  storage: StorageLike | null = getBrowserStorage()
): BrowseIntentState | null {
  if (!storage) return null;
  const existing = getLastBrowseIntent(storage);
  const next: BrowseIntentState = {
    lastSeenAt: new Date().toISOString(),
    lastSearchParams:
      patch.lastSearchParams !== undefined
        ? normalizeSearchParams(patch.lastSearchParams)
        : (existing?.lastSearchParams ?? null),
    lastHub:
      patch.lastHub !== undefined
        ? patch.lastHub
        : (existing?.lastHub ?? null),
    lastViewedListingId:
      patch.lastViewedListingId !== undefined
        ? patch.lastViewedListingId ?? null
        : (existing?.lastViewedListingId ?? null),
  };
  storage.setItem(BROWSE_INTENT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearLastBrowseIntent(storage: StorageLike | null = getBrowserStorage()): void {
  storage?.removeItem(BROWSE_INTENT_STORAGE_KEY);
}

export function isBrowseIntentRecent(
  intent: BrowseIntentState | null,
  maxAgeDays = 14,
  now = Date.now()
): boolean {
  if (!intent?.lastSeenAt) return false;
  const lastSeenMs = Date.parse(intent.lastSeenAt);
  if (!Number.isFinite(lastSeenMs)) return false;
  const maxAgeMs = Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000;
  return now - lastSeenMs <= maxAgeMs;
}

export function getRecentBrowseIntent(
  maxAgeDays = 14,
  storage: StorageLike | null = getBrowserStorage(),
  now = Date.now()
): BrowseIntentState | null {
  const intent = getLastBrowseIntent(storage);
  if (!isBrowseIntentRecent(intent, maxAgeDays, now)) return null;
  return intent;
}

export function dismissBrowseContinueForSession(session: StorageLike | null = getSessionStorage()): void {
  session?.setItem(BROWSE_INTENT_DISMISS_SESSION_KEY, "1");
}

export function isBrowseContinueDismissed(session: StorageLike | null = getSessionStorage()): boolean {
  return session?.getItem(BROWSE_INTENT_DISMISS_SESSION_KEY) === "1";
}

