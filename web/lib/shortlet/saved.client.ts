export type ShortletSavedEntry = {
  id: string;
  savedAt: string;
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const SHORTLET_SAVED_KEY = "shortlets:saved";
const MAX_SAVED_ITEMS = 400;

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function toIso(value: Date | string | number = Date.now()): string {
  try {
    return new Date(value).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function normalizeId(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return normalized;
}

function safeParseSaved(input: string | null): ShortletSavedEntry[] {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input) as Array<Partial<ShortletSavedEntry>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: normalizeId(item?.id) ?? "",
        savedAt: toIso(item?.savedAt ?? Date.now()),
      }))
      .filter((item) => !!item.id)
      .slice(0, MAX_SAVED_ITEMS);
  } catch {
    return [];
  }
}

function writeSavedEntries(entries: ShortletSavedEntry[], storage?: StorageLike | null): void {
  const target = resolveStorage(storage);
  if (!target) return;
  if (!entries.length) {
    target.removeItem(SHORTLET_SAVED_KEY);
    return;
  }
  target.setItem(SHORTLET_SAVED_KEY, JSON.stringify(entries.slice(0, MAX_SAVED_ITEMS)));
}

export function getSavedEntries(storage?: StorageLike | null): ShortletSavedEntry[] {
  const target = resolveStorage(storage);
  if (!target) return [];
  return safeParseSaved(target.getItem(SHORTLET_SAVED_KEY));
}

export function getSavedIds(storage?: StorageLike | null): string[] {
  return getSavedEntries(storage).map((entry) => entry.id);
}

export function isSaved(id: string, storage?: StorageLike | null): boolean {
  const normalizedId = normalizeId(id);
  if (!normalizedId) return false;
  return getSavedEntries(storage).some((entry) => entry.id === normalizedId);
}

export function toggleSaved(
  id: string,
  storage?: StorageLike | null
): {
  saved: boolean;
  ids: string[];
} {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    return { saved: false, ids: getSavedIds(storage) };
  }

  const current = getSavedEntries(storage);
  const existingIndex = current.findIndex((entry) => entry.id === normalizedId);
  if (existingIndex >= 0) {
    const next = [...current.slice(0, existingIndex), ...current.slice(existingIndex + 1)];
    writeSavedEntries(next, storage);
    return {
      saved: false,
      ids: next.map((entry) => entry.id),
    };
  }

  const next = [{ id: normalizedId, savedAt: toIso() }, ...current].slice(0, MAX_SAVED_ITEMS);
  writeSavedEntries(next, storage);
  return {
    saved: true,
    ids: next.map((entry) => entry.id),
  };
}
