export type HostHomePanelKey =
  | "getting_started"
  | "snapshot"
  | "demand_alerts"
  | "analytics_preview";

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export function buildHostHomePanelOpenStorageKey(key: HostHomePanelKey): string {
  return `host:home:panel:${key}:open:v1`;
}

export function parseHostHomePanelOpenPreference(
  value: string | null,
  defaultOpen: boolean
): boolean {
  if (value === "1") return true;
  if (value === "0") return false;
  return defaultOpen;
}

export function readHostHomePanelOpenPreference(
  storage: StorageLike | null,
  key: HostHomePanelKey,
  defaultOpen: boolean
): boolean {
  if (!storage) return defaultOpen;
  return parseHostHomePanelOpenPreference(
    storage.getItem(buildHostHomePanelOpenStorageKey(key)),
    defaultOpen
  );
}

export function writeHostHomePanelOpenPreference(
  storage: StorageLike | null,
  key: HostHomePanelKey,
  open: boolean
): void {
  if (!storage) return;
  storage.setItem(buildHostHomePanelOpenStorageKey(key), open ? "1" : "0");
}

export function toggleHostHomePanelOpenPreference(
  storage: StorageLike | null,
  key: HostHomePanelKey,
  current: boolean
): boolean {
  const next = !current;
  writeHostHomePanelOpenPreference(storage, key, next);
  return next;
}
