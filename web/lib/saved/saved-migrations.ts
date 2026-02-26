import type { SavedItemRecord, SavedStorePayload } from "@/lib/saved/saved-schema";

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function extractSavedItemsFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isObject(payload) && Array.isArray(payload.items)) {
    return payload.items;
  }
  return [];
}

export function toSavedStorePayload(items: SavedItemRecord[]): SavedStorePayload {
  return {
    version: 1,
    items,
  };
}
