import {
  SAVED_KINDS,
  SAVED_MAX_ITEMS,
  SAVED_STORAGE_EVENT,
  SAVED_STORAGE_KEY,
  SAVED_STORAGE_VERSION,
  type SavedItemInput,
  type SavedItemKind,
  type SavedItemRecord,
  type SavedStorePayload,
} from "@/lib/saved/saved-schema";
import { extractSavedItemsFromPayload, toSavedStorePayload } from "@/lib/saved/saved-migrations";

const SAVED_KIND_SET = new Set<SavedItemKind>(SAVED_KINDS);

function normalizeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeCountryCode(value: unknown): string {
  const normalized = normalizeString(value, 8).toUpperCase();
  return /^[A-Z]{2,3}$/.test(normalized) ? normalized : "GLOBAL";
}

function normalizeHref(value: unknown): string {
  const href = normalizeString(value, 300);
  if (!href.startsWith("/")) return "";
  return href;
}

function normalizeKind(value: unknown): SavedItemKind | null {
  if (typeof value !== "string") return null;
  return SAVED_KIND_SET.has(value as SavedItemKind) ? (value as SavedItemKind) : null;
}

function normalizeDateIso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
}

export function toSavedItemRecord(input: SavedItemInput | null | undefined): SavedItemRecord | null {
  if (!input) return null;
  const id = normalizeString(input.id, 140);
  const kind = normalizeKind(input.kind);
  const href = normalizeHref(input.href);
  const title = normalizeString(input.title, 200);
  const marketCountry = normalizeCountryCode(input.marketCountry);
  if (!id || !kind || !href || !title) return null;

  const subtitle = normalizeString(input.subtitle, 280) || undefined;
  const tag = normalizeString(input.tag, 64) || undefined;

  return {
    id,
    kind,
    marketCountry,
    href,
    title,
    subtitle,
    tag,
    savedAt: normalizeDateIso(input.savedAt ?? null),
  };
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function makeItemKey(item: Pick<SavedItemRecord, "id" | "marketCountry">): string {
  return `${item.marketCountry}:${item.id}`;
}

export function parseSavedStoreValue(raw: string | null | undefined): SavedItemRecord[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const extracted = extractSavedItemsFromPayload(parsed);
  const seen = new Set<string>();
  const normalized: SavedItemRecord[] = [];

  for (const candidate of extracted) {
    const record = toSavedItemRecord(candidate as SavedItemInput);
    if (!record) continue;
    const key = makeItemKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(record);
  }

  normalized.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return normalized.slice(0, SAVED_MAX_ITEMS);
}

function readSavedItemsFromStorage(storage: Storage): SavedItemRecord[] {
  const value = storage.getItem(SAVED_STORAGE_KEY);
  return parseSavedStoreValue(value);
}

function writeSavedItemsToStorage(storage: Storage, items: SavedItemRecord[]): SavedItemRecord[] {
  const normalized = Array.from(items)
    .map((item) => toSavedItemRecord(item))
    .filter((item): item is SavedItemRecord => !!item)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, SAVED_MAX_ITEMS);

  const payload: SavedStorePayload = {
    ...toSavedStorePayload(normalized),
    version: SAVED_STORAGE_VERSION,
  };
  storage.setItem(SAVED_STORAGE_KEY, JSON.stringify(payload));
  return normalized;
}

function emitSavedStoreChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SAVED_STORAGE_EVENT));
}

export function getSavedItems(input?: {
  marketCountry?: string | null;
  limit?: number;
}): SavedItemRecord[] {
  const storage = getStorage();
  if (!storage) return [];
  const items = readSavedItemsFromStorage(storage);
  const marketCountry = normalizeCountryCode(input?.marketCountry ?? null);
  const scoped = input?.marketCountry ? items.filter((item) => item.marketCountry === marketCountry) : items;
  const limit = Math.max(1, Math.min(SAVED_MAX_ITEMS, input?.limit ?? SAVED_MAX_ITEMS));
  return scoped.slice(0, limit);
}

export function isSavedItem(id: string, marketCountry: string | null | undefined): boolean {
  if (!id.trim()) return false;
  const items = getSavedItems({ marketCountry });
  return items.some((item) => item.id === id.trim());
}

export function toggleSavedItem(input: SavedItemInput): { saved: boolean; items: SavedItemRecord[] } {
  const storage = getStorage();
  if (!storage) {
    return { saved: false, items: [] };
  }

  const next = toSavedItemRecord(input);
  if (!next) {
    return { saved: false, items: readSavedItemsFromStorage(storage) };
  }

  const existing = readSavedItemsFromStorage(storage);
  const key = makeItemKey(next);
  const withoutCurrent = existing.filter((item) => makeItemKey(item) !== key);
  const alreadySaved = withoutCurrent.length !== existing.length;

  const updated = alreadySaved
    ? withoutCurrent
    : [{ ...next, savedAt: new Date().toISOString() }, ...withoutCurrent];

  const stored = writeSavedItemsToStorage(storage, updated);
  emitSavedStoreChanged();

  return {
    saved: !alreadySaved,
    items: stored,
  };
}

export function clearSavedItems(input?: { marketCountry?: string | null }): SavedItemRecord[] {
  const storage = getStorage();
  if (!storage) return [];

  if (!input?.marketCountry) {
    storage.removeItem(SAVED_STORAGE_KEY);
    emitSavedStoreChanged();
    return [];
  }

  const marketCountry = normalizeCountryCode(input.marketCountry);
  const existing = readSavedItemsFromStorage(storage);
  const remaining = existing.filter((item) => item.marketCountry !== marketCountry);
  const stored = writeSavedItemsToStorage(storage, remaining);
  emitSavedStoreChanged();
  return stored;
}

export function removeSavedItem(input: {
  id: string;
  marketCountry?: string | null;
}): SavedItemRecord[] {
  const storage = getStorage();
  if (!storage) return [];

  const id = normalizeString(input.id, 140);
  if (!id) return readSavedItemsFromStorage(storage);

  const marketCountry = input.marketCountry ? normalizeCountryCode(input.marketCountry) : null;
  const existing = readSavedItemsFromStorage(storage);
  const remaining = existing.filter((item) => {
    if (item.id !== id) return true;
    if (!marketCountry) return false;
    return item.marketCountry !== marketCountry;
  });

  const stored = writeSavedItemsToStorage(storage, remaining);
  emitSavedStoreChanged();
  return stored;
}

export function clearSavedSection(input: {
  kind: SavedItemKind;
  marketCountry?: string | null;
}): SavedItemRecord[] {
  const storage = getStorage();
  if (!storage) return [];

  const kind = normalizeKind(input.kind);
  if (!kind) return readSavedItemsFromStorage(storage);

  const marketCountry = input.marketCountry ? normalizeCountryCode(input.marketCountry) : null;
  const existing = readSavedItemsFromStorage(storage);
  const remaining = existing.filter((item) => {
    if (item.kind !== kind) return true;
    if (!marketCountry) return false;
    return item.marketCountry !== marketCountry;
  });

  const stored = writeSavedItemsToStorage(storage, remaining);
  emitSavedStoreChanged();
  return stored;
}

export function groupSavedItemsByKind(items: ReadonlyArray<SavedItemRecord>): {
  shortlets: SavedItemRecord[];
  properties: SavedItemRecord[];
} {
  const shortlets: SavedItemRecord[] = [];
  const properties: SavedItemRecord[] = [];
  for (const item of items) {
    if (item.kind === "shortlet") {
      shortlets.push(item);
      continue;
    }
    properties.push(item);
  }
  return { shortlets, properties };
}

export function subscribeSavedItems(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== SAVED_STORAGE_KEY) return;
    listener();
  };

  const onCustom = () => {
    listener();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(SAVED_STORAGE_EVENT, onCustom);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SAVED_STORAGE_EVENT, onCustom);
  };
}
