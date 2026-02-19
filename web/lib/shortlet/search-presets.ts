import { formatShortletGuestsLabel, normalizeShortletGuestsParam } from "@/lib/shortlet/search-ui-state";

export type ShortletSearchPreset = {
  id: string;
  label: string;
  params: Record<string, string>;
  createdAt: string;
};

const RECENTS_KEY = "shortlets:recentSearches";
const SAVED_KEY = "shortlets:savedSearches";
const RECENTS_LIMIT = 8;
const SAVED_LIMIT = 12;

function toIso(value: Date | string | number = Date.now()): string {
  try {
    return new Date(value).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isStorageAvailable(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function safeParse(input: string | null): ShortletSearchPreset[] {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input) as ShortletSearchPreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => !!item && typeof item === "object" && !!item.id && !!item.params);
  } catch {
    return [];
  }
}

function stableParamEntries(params: Record<string, string>): Array<[string, string]> {
  return Object.entries(params)
    .filter((entry) => entry[1] !== "")
    .sort((left, right) => left[0].localeCompare(right[0]));
}

function createParamsSignature(params: Record<string, string>): string {
  return stableParamEntries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export function createPresetParamsFromSearchParams(
  params: URLSearchParams,
  allowedKeys: readonly string[] = [
    "where",
    "placeId",
    "lat",
    "lng",
    "checkIn",
    "checkOut",
    "guests",
    "sort",
    "bookingMode",
    "freeCancellation",
    "powerBackup",
    "waterBorehole",
    "security",
    "wifi",
    "verifiedHost",
    "market",
    "bbox",
  ]
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const key of allowedKeys) {
    const value = params.get(key);
    if (value) {
      next[key] = value;
    }
  }

  if (!next.guests) {
    next.guests = String(normalizeShortletGuestsParam(params.get("guests")));
  }
  return next;
}

export function buildShortletPresetLabel(params: Record<string, string>): string {
  const where = params.where?.trim() || "Anywhere";
  const guestsLabel = formatShortletGuestsLabel(params.guests ?? "1");
  const hasDates = !!params.checkIn && !!params.checkOut;
  const dates = hasDates ? `${params.checkIn} → ${params.checkOut}` : "Any dates";
  return `${where} · ${guestsLabel} · ${dates}`;
}

export function addPresetToList(input: {
  existing: ShortletSearchPreset[];
  params: Record<string, string>;
  limit: number;
  label?: string;
  now?: string | Date | number;
}): ShortletSearchPreset[] {
  const signature = createParamsSignature(input.params);
  const createdAt = toIso(input.now);
  const label = input.label || buildShortletPresetLabel(input.params);
  const candidate: ShortletSearchPreset = {
    id: createId(),
    label,
    params: input.params,
    createdAt,
  };

  const withoutDupes = input.existing.filter(
    (preset) => createParamsSignature(preset.params) !== signature
  );
  return [candidate, ...withoutDupes].slice(0, input.limit);
}

export function removePresetFromList(existing: ShortletSearchPreset[], id: string): ShortletSearchPreset[] {
  return existing.filter((preset) => preset.id !== id);
}

export function readRecentSearchPresets(): ShortletSearchPreset[] {
  if (!isStorageAvailable()) return [];
  return safeParse(window.localStorage.getItem(RECENTS_KEY)).slice(0, RECENTS_LIMIT);
}

export function writeRecentSearchPresets(next: ShortletSearchPreset[]): void {
  if (!isStorageAvailable()) return;
  window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next.slice(0, RECENTS_LIMIT)));
}

export function addRecentSearchPreset(params: Record<string, string>): ShortletSearchPreset[] {
  const next = addPresetToList({
    existing: readRecentSearchPresets(),
    params,
    limit: RECENTS_LIMIT,
  });
  writeRecentSearchPresets(next);
  return next;
}

export function clearRecentSearchPresets(): void {
  if (!isStorageAvailable()) return;
  window.localStorage.removeItem(RECENTS_KEY);
}

export function readSavedSearchPresets(): ShortletSearchPreset[] {
  if (!isStorageAvailable()) return [];
  return safeParse(window.localStorage.getItem(SAVED_KEY)).slice(0, SAVED_LIMIT);
}

export function writeSavedSearchPresets(next: ShortletSearchPreset[]): void {
  if (!isStorageAvailable()) return;
  window.localStorage.setItem(SAVED_KEY, JSON.stringify(next.slice(0, SAVED_LIMIT)));
}

export function saveSearchPreset(
  params: Record<string, string>,
  label?: string
): ShortletSearchPreset[] {
  const next = addPresetToList({
    existing: readSavedSearchPresets(),
    params,
    label,
    limit: SAVED_LIMIT,
  });
  writeSavedSearchPresets(next);
  return next;
}

export function removeSavedSearchPreset(id: string): ShortletSearchPreset[] {
  const next = removePresetFromList(readSavedSearchPresets(), id);
  writeSavedSearchPresets(next);
  return next;
}

export function presetParamsToSearchParams(params: Record<string, string>): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of stableParamEntries(params)) {
    next.set(key, value);
  }
  return next;
}
