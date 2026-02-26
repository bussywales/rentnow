import {
  VIEWED_KINDS,
  VIEWED_MAX_ITEMS,
  VIEWED_STORAGE_EVENT,
  VIEWED_STORAGE_KEY,
  VIEWED_STORAGE_VERSION,
  type ViewedItemInput,
  type ViewedItemKind,
  type ViewedItemRecord,
  type ViewedStorePayload,
} from "@/lib/viewed/viewed-schema";

const VIEWED_KIND_SET = new Set<ViewedItemKind>(VIEWED_KINDS);

function normalizeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeCountryCode(value: unknown): string {
  const normalized = normalizeString(value, 8).toUpperCase();
  return /^[A-Z]{2,3}$/.test(normalized) ? normalized : "GLOBAL";
}

function normalizeHref(value: unknown): string {
  const href = normalizeString(value, 400);
  return href.startsWith("/") ? href : "";
}

function normalizeKind(value: unknown): ViewedItemKind | null {
  if (typeof value !== "string") return null;
  return VIEWED_KIND_SET.has(value as ViewedItemKind) ? (value as ViewedItemKind) : null;
}

function normalizeDateIso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

export function toViewedItemRecord(input: ViewedItemInput | null | undefined): ViewedItemRecord | null {
  if (!input) return null;
  const id = normalizeString(input.id, 180);
  const kind = normalizeKind(input.kind);
  const marketCountry = normalizeCountryCode(input.marketCountry);
  const href = normalizeHref(input.href);
  if (!id || !kind || !href) return null;

  const title = normalizeString(input.title, 220) || undefined;
  const subtitle = normalizeString(input.subtitle, 320) || undefined;
  const tag = normalizeString(input.tag, 80) || undefined;

  return {
    id,
    kind,
    marketCountry,
    href,
    viewedAt: normalizeDateIso(input.viewedAt ?? null),
    title,
    subtitle,
    tag,
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

function makeItemKey(item: Pick<ViewedItemRecord, "id" | "kind" | "marketCountry">): string {
  return `${item.marketCountry}:${item.kind}:${item.id}`;
}

export function parseViewedStoreValue(raw: string | null | undefined): ViewedItemRecord[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const candidates = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { items?: unknown[] }).items)
    ? (parsed as { items: unknown[] }).items
    : [];

  const seen = new Set<string>();
  const normalized: ViewedItemRecord[] = [];
  for (const candidate of candidates) {
    const record = toViewedItemRecord(candidate as ViewedItemInput);
    if (!record) continue;
    const key = makeItemKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(record);
  }

  normalized.sort((a, b) => b.viewedAt.localeCompare(a.viewedAt));
  return normalized.slice(0, VIEWED_MAX_ITEMS);
}

function readViewedItemsFromStorage(storage: Storage): ViewedItemRecord[] {
  return parseViewedStoreValue(storage.getItem(VIEWED_STORAGE_KEY));
}

function writeViewedItemsToStorage(storage: Storage, items: ViewedItemRecord[]): ViewedItemRecord[] {
  const normalized = Array.from(items)
    .map((item) => toViewedItemRecord(item))
    .filter((item): item is ViewedItemRecord => !!item)
    .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
    .slice(0, VIEWED_MAX_ITEMS);

  const payload: ViewedStorePayload = {
    version: VIEWED_STORAGE_VERSION,
    items: normalized,
  };
  storage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(payload));
  return normalized;
}

function emitViewedStoreChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VIEWED_STORAGE_EVENT));
}

export function getViewedItems(input?: {
  marketCountry?: string | null;
  kind?: ViewedItemKind | null;
  limit?: number;
}): ViewedItemRecord[] {
  const storage = getStorage();
  if (!storage) return [];

  const marketCountry = input?.marketCountry ? normalizeCountryCode(input.marketCountry) : null;
  const kind = input?.kind ? normalizeKind(input.kind) : null;
  const limit = Math.max(1, Math.min(VIEWED_MAX_ITEMS, input?.limit ?? VIEWED_MAX_ITEMS));

  return readViewedItemsFromStorage(storage)
    .filter((item) => (!marketCountry ? true : item.marketCountry === marketCountry))
    .filter((item) => (!kind ? true : item.kind === kind))
    .slice(0, limit);
}

export function pushViewedItem(input: ViewedItemInput): ViewedItemRecord[] {
  const storage = getStorage();
  if (!storage) return [];

  const next = toViewedItemRecord(input);
  if (!next) return readViewedItemsFromStorage(storage);

  const existing = readViewedItemsFromStorage(storage);
  const key = makeItemKey(next);
  const withoutCurrent = existing.filter((item) => makeItemKey(item) !== key);
  const updated = [{ ...next, viewedAt: new Date().toISOString() }, ...withoutCurrent];
  const stored = writeViewedItemsToStorage(storage, updated);
  emitViewedStoreChanged();
  return stored;
}

export function clearViewedItems(input?: { marketCountry?: string | null }): ViewedItemRecord[] {
  const storage = getStorage();
  if (!storage) return [];

  if (!input?.marketCountry) {
    storage.removeItem(VIEWED_STORAGE_KEY);
    emitViewedStoreChanged();
    return [];
  }

  const marketCountry = normalizeCountryCode(input.marketCountry);
  const existing = readViewedItemsFromStorage(storage);
  const remaining = existing.filter((item) => item.marketCountry !== marketCountry);
  const stored = writeViewedItemsToStorage(storage, remaining);
  emitViewedStoreChanged();
  return stored;
}

export function subscribeViewedItems(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== VIEWED_STORAGE_KEY) return;
    listener();
  };
  const onCustom = () => listener();

  window.addEventListener("storage", onStorage);
  window.addEventListener(VIEWED_STORAGE_EVENT, onCustom);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(VIEWED_STORAGE_EVENT, onCustom);
  };
}
