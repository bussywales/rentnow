export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type HomeCollapsedSection =
  | "workspace-tools"
  | "getting-started"
  | "snapshot"
  | "demand-alerts"
  | "analytics-preview";

export function buildHomeCollapsedStorageKey(input: {
  role: "agent" | "landlord";
  userId?: string | null;
  section: HomeCollapsedSection;
  version?: string;
}): string {
  const version = input.version || "v1";
  const identityScope = input.userId ? `${input.role}:${input.userId}` : input.role;
  return `home:${identityScope}:${input.section}:collapsed:${version}`;
}

export function parseCollapsedPreference(
  value: string | null,
  defaultCollapsed = true
): boolean {
  if (value === "1") return true;
  if (value === "0") return false;
  return defaultCollapsed;
}

export function readCollapsedPreference(
  storage: StorageLike | null,
  key: string,
  defaultCollapsed = true
): boolean {
  if (!storage) return defaultCollapsed;
  return parseCollapsedPreference(storage.getItem(key), defaultCollapsed);
}

export function writeCollapsedPreference(
  storage: StorageLike | null,
  key: string,
  collapsed: boolean
): void {
  if (!storage) return;
  storage.setItem(key, collapsed ? "1" : "0");
}

export function toggleCollapsedPreference(
  storage: StorageLike | null,
  key: string,
  current: boolean
): boolean {
  const next = !current;
  writeCollapsedPreference(storage, key, next);
  return next;
}
