const DEFAULT_RECENTS_LIMIT = 5;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_RECENTS_LIMIT;
  return Math.floor(limit);
}

function normalizeValue(value: string): string {
  return value.trim();
}

function normalizeKey(value: string): string {
  return normalizeValue(value).toLowerCase();
}

function parseRecents(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

function readRecents(key: string): string[] {
  try {
    return parseRecents(window.localStorage.getItem(key));
  } catch {
    return [];
  }
}

function writeRecents(key: string, values: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Ignore storage write failures (private mode / quota / blocked storage).
  }
}

export function getRecentSearches(key: string, limit = DEFAULT_RECENTS_LIMIT): string[] {
  if (!isBrowser()) return [];
  const size = normalizeLimit(limit);
  return readRecents(key).slice(0, size);
}

export function pushRecentSearch(key: string, value: string, limit = DEFAULT_RECENTS_LIMIT): string[] {
  const normalized = normalizeValue(value);
  if (!normalized) return getRecentSearches(key, limit);
  if (!isBrowser()) return [];

  const size = normalizeLimit(limit);
  const normalizedCandidateKey = normalizeKey(normalized);
  const next = [
    normalized,
    ...readRecents(key).filter((item) => normalizeKey(item) !== normalizedCandidateKey),
  ].slice(0, size);

  writeRecents(key, next);
  return next;
}

export function clearRecentSearches(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage removal failures.
  }
}
