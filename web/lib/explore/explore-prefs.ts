export const EXPLORE_PREFS_STORAGE_KEY = "ph:explore:prefs:v0_2";
export const EXPLORE_PREFS_EVENT = "ph:explore:prefs:v0_2:changed";
export const EXPLORE_MAX_HIDDEN_IDS = 200;

type ExplorePrefsPayload = {
  version: 1;
  seenDetailsHint: boolean;
  hiddenListingIds: string[];
};

const DEFAULT_EXPLORE_PREFS: ExplorePrefsPayload = {
  version: 1,
  seenDetailsHint: false,
  hiddenListingIds: [],
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeListingId(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 180);
}

function normalizeHiddenListingIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => normalizeListingId(item))
    .filter((item) => item.length > 0);
  return Array.from(new Set(normalized)).slice(0, EXPLORE_MAX_HIDDEN_IDS);
}

export function parseExplorePrefs(raw: string | null | undefined): ExplorePrefsPayload {
  if (!raw) return { ...DEFAULT_EXPLORE_PREFS };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_EXPLORE_PREFS };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ...DEFAULT_EXPLORE_PREFS };
  }

  const record = parsed as Partial<ExplorePrefsPayload>;
  return {
    version: 1,
    seenDetailsHint: Boolean(record.seenDetailsHint),
    hiddenListingIds: normalizeHiddenListingIds(record.hiddenListingIds),
  };
}

function writeExplorePrefs(storage: Storage, payload: ExplorePrefsPayload): ExplorePrefsPayload {
  const normalized: ExplorePrefsPayload = {
    version: 1,
    seenDetailsHint: Boolean(payload.seenDetailsHint),
    hiddenListingIds: normalizeHiddenListingIds(payload.hiddenListingIds),
  };
  storage.setItem(EXPLORE_PREFS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function emitExplorePrefsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EXPLORE_PREFS_EVENT));
}

function readExplorePrefsFromStorage(storage: Storage): ExplorePrefsPayload {
  return parseExplorePrefs(storage.getItem(EXPLORE_PREFS_STORAGE_KEY));
}

export function getHiddenExploreListingIds(): string[] {
  const storage = getStorage();
  if (!storage) return [];
  return readExplorePrefsFromStorage(storage).hiddenListingIds;
}

export function hasSeenExploreDetailsHint(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  return readExplorePrefsFromStorage(storage).seenDetailsHint;
}

export function markExploreDetailsHintSeen(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const current = readExplorePrefsFromStorage(storage);
  if (current.seenDetailsHint) return true;
  writeExplorePrefs(storage, { ...current, seenDetailsHint: true });
  emitExplorePrefsChanged();
  return true;
}

export function hideExploreListingId(listingId: string): string[] {
  const storage = getStorage();
  if (!storage) return [];
  const normalizedId = normalizeListingId(listingId);
  if (!normalizedId) return readExplorePrefsFromStorage(storage).hiddenListingIds;
  const current = readExplorePrefsFromStorage(storage);
  const nextIds = Array.from(new Set([normalizedId, ...current.hiddenListingIds])).slice(0, EXPLORE_MAX_HIDDEN_IDS);
  writeExplorePrefs(storage, {
    ...current,
    hiddenListingIds: nextIds,
  });
  emitExplorePrefsChanged();
  return nextIds;
}

export function unhideExploreListingId(listingId: string): string[] {
  const storage = getStorage();
  if (!storage) return [];
  const normalizedId = normalizeListingId(listingId);
  if (!normalizedId) return readExplorePrefsFromStorage(storage).hiddenListingIds;
  const current = readExplorePrefsFromStorage(storage);
  const nextIds = current.hiddenListingIds.filter((item) => item !== normalizedId);
  writeExplorePrefs(storage, {
    ...current,
    hiddenListingIds: nextIds,
  });
  emitExplorePrefsChanged();
  return nextIds;
}

export function clearHiddenExploreListingIds(): string[] {
  const storage = getStorage();
  if (!storage) return [];
  const current = readExplorePrefsFromStorage(storage);
  writeExplorePrefs(storage, {
    ...current,
    hiddenListingIds: [],
  });
  emitExplorePrefsChanged();
  return [];
}

export function subscribeExplorePrefs(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== EXPLORE_PREFS_STORAGE_KEY) return;
    listener();
  };

  const onCustom = () => {
    listener();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(EXPLORE_PREFS_EVENT, onCustom);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EXPLORE_PREFS_EVENT, onCustom);
  };
}
