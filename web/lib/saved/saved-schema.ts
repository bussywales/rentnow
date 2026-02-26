export const SAVED_STORAGE_KEY = "ph:saved:v0";
export const SAVED_STORAGE_EVENT = "ph:saved:v0:changed";
export const SAVED_STORAGE_VERSION = 1;
export const SAVED_MAX_ITEMS = 100;

export const SAVED_KINDS = ["shortlet", "property"] as const;

export type SavedItemKind = (typeof SAVED_KINDS)[number];

export type SavedItemRecord = {
  id: string;
  kind: SavedItemKind;
  marketCountry: string;
  href: string;
  title: string;
  subtitle?: string;
  tag?: string;
  savedAt: string;
};

export type SavedItemInput = Omit<SavedItemRecord, "savedAt"> & {
  savedAt?: string | Date | null;
};

export type SavedStorePayload = {
  version: number;
  items: SavedItemRecord[];
};
