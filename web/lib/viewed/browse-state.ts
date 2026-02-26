import type { ViewedItemKind } from "@/lib/viewed/viewed-schema";

export const BROWSE_STATE_STORAGE_KEY = "ph:viewed:last-browse:v0";
export const BROWSE_STATE_EVENT = "ph:viewed:last-browse:v0:changed";

const BROWSE_MAX_AGE_DAYS = 14;
const ALLOWED_PREFIXES = ["/shortlets", "/properties"] as const;

type BrowseStateRecord = {
  kind: ViewedItemKind;
  marketCountry: string;
  href: string;
  updatedAt: string;
};

type BrowseStatePayload = {
  version: 1;
  records: BrowseStateRecord[];
};

function normalizeCountryCode(value: unknown): string {
  if (typeof value !== "string") return "GLOBAL";
  const normalized = value.trim().toUpperCase().slice(0, 8);
  return /^[A-Z]{2,3}$/.test(normalized) ? normalized : "GLOBAL";
}

function normalizeKind(value: unknown): ViewedItemKind | null {
  if (value === "shortlet" || value === "property") return value;
  return null;
}

function normalizeDateIso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

export function isAllowedBrowseHref(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const href = value.trim();
  if (!href.startsWith("/")) return false;
  if (!href.includes("?")) return false;
  return ALLOWED_PREFIXES.some((prefix) => href.startsWith(prefix));
}

function normalizeHref(value: unknown): string {
  if (!isAllowedBrowseHref(value)) return "";
  return value.trim().slice(0, 600);
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function makeKey(input: { kind: ViewedItemKind; marketCountry: string }): string {
  return `${input.marketCountry}:${input.kind}`;
}

function parseBrowseStateValue(raw: string | null | undefined): BrowseStateRecord[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const candidates = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { records?: unknown[] }).records)
    ? (parsed as { records: unknown[] }).records
    : [];

  const seen = new Set<string>();
  const normalized: BrowseStateRecord[] = [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Partial<BrowseStateRecord>;
    const kind = normalizeKind(record.kind);
    const marketCountry = normalizeCountryCode(record.marketCountry);
    const href = normalizeHref(record.href);
    if (!kind || !href) continue;
    const key = makeKey({ kind, marketCountry });
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      kind,
      marketCountry,
      href,
      updatedAt: normalizeDateIso(record.updatedAt),
    });
  }

  normalized.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return normalized;
}

function readBrowseState(storage: Storage): BrowseStateRecord[] {
  return parseBrowseStateValue(storage.getItem(BROWSE_STATE_STORAGE_KEY));
}

function writeBrowseState(storage: Storage, records: BrowseStateRecord[]): BrowseStateRecord[] {
  const normalized = parseBrowseStateValue(JSON.stringify(records));
  const payload: BrowseStatePayload = {
    version: 1,
    records: normalized,
  };
  storage.setItem(BROWSE_STATE_STORAGE_KEY, JSON.stringify(payload));
  return normalized;
}

function emitBrowseStateChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BROWSE_STATE_EVENT));
}

export function setLastBrowseUrl(input: {
  kind: ViewedItemKind;
  marketCountry?: string | null;
  href: string;
}) {
  const storage = getStorage();
  if (!storage) return null;

  const kind = normalizeKind(input.kind);
  const href = normalizeHref(input.href);
  if (!kind || !href) return null;

  const marketCountry = normalizeCountryCode(input.marketCountry ?? null);
  const record: BrowseStateRecord = {
    kind,
    marketCountry,
    href,
    updatedAt: new Date().toISOString(),
  };

  const existing = readBrowseState(storage).filter(
    (item) => makeKey(item) !== makeKey(record)
  );
  const stored = writeBrowseState(storage, [record, ...existing]);
  emitBrowseStateChanged();
  return stored;
}

export function getLastBrowseUrl(input: {
  kind: ViewedItemKind;
  marketCountry?: string | null;
  maxAgeDays?: number;
}): string | null {
  const storage = getStorage();
  if (!storage) return null;

  const kind = normalizeKind(input.kind);
  if (!kind) return null;
  const marketCountry = normalizeCountryCode(input.marketCountry ?? null);
  const maxAgeDays = Math.max(1, Math.floor(input.maxAgeDays ?? BROWSE_MAX_AGE_DAYS));
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const match = readBrowseState(storage).find(
    (item) => item.kind === kind && item.marketCountry === marketCountry
  );
  if (!match) return null;
  const updatedAtMs = Date.parse(match.updatedAt);
  if (!Number.isFinite(updatedAtMs)) return null;
  if (now - updatedAtMs > maxAgeMs) return null;
  return match.href;
}

export function clearLastBrowseUrl(input?: {
  kind?: ViewedItemKind;
  marketCountry?: string | null;
}) {
  const storage = getStorage();
  if (!storage) return;

  if (!input?.kind && !input?.marketCountry) {
    storage.removeItem(BROWSE_STATE_STORAGE_KEY);
    emitBrowseStateChanged();
    return;
  }

  const kind = input?.kind ? normalizeKind(input.kind) : null;
  const marketCountry = input?.marketCountry ? normalizeCountryCode(input.marketCountry) : null;
  const existing = readBrowseState(storage);
  const remaining = existing.filter((item) => {
    if (kind && item.kind !== kind) return true;
    if (marketCountry && item.marketCountry !== marketCountry) return true;
    return false;
  });

  writeBrowseState(storage, remaining);
  emitBrowseStateChanged();
}

export function subscribeLastBrowseUrl(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== BROWSE_STATE_STORAGE_KEY) return;
    listener();
  };
  const onCustom = () => listener();

  window.addEventListener("storage", onStorage);
  window.addEventListener(BROWSE_STATE_EVENT, onCustom);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(BROWSE_STATE_EVENT, onCustom);
  };
}
