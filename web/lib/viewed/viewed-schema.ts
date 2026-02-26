export const VIEWED_STORAGE_KEY = "ph:viewed:v0";
export const VIEWED_STORAGE_EVENT = "ph:viewed:v0:changed";
export const VIEWED_STORAGE_VERSION = 1;
export const VIEWED_MAX_ITEMS = 30;

export const VIEWED_KINDS = ["shortlet", "property"] as const;

export type ViewedItemKind = (typeof VIEWED_KINDS)[number];

export type ViewedItemRecord = {
  id: string;
  kind: ViewedItemKind;
  marketCountry: string;
  href: string;
  viewedAt: string;
  title?: string;
  subtitle?: string;
  tag?: string;
};

export type ViewedItemInput = Omit<ViewedItemRecord, "viewedAt"> & {
  viewedAt?: string | Date | null;
};

export type ViewedStorePayload = {
  version: number;
  items: ViewedItemRecord[];
};
