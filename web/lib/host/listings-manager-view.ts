export const HOST_LISTINGS_MANAGER_VIEW_STORAGE_KEY = "host:listings:view:v1";

export type HostListingsManagerView = "portfolio" | "manage";

export function parseHostListingsManagerView(
  value: string | null | undefined
): HostListingsManagerView | null {
  if (value === "portfolio" || value === "manage") return value;
  return null;
}

export function readHostListingsManagerView(
  storage: Pick<Storage, "getItem"> | null | undefined
): HostListingsManagerView {
  if (!storage) return "portfolio";
  return parseHostListingsManagerView(storage.getItem(HOST_LISTINGS_MANAGER_VIEW_STORAGE_KEY)) ?? "portfolio";
}

export function writeHostListingsManagerView(
  storage: Pick<Storage, "setItem"> | null | undefined,
  view: HostListingsManagerView
): HostListingsManagerView {
  const resolved = parseHostListingsManagerView(view) ?? "portfolio";
  storage?.setItem(HOST_LISTINGS_MANAGER_VIEW_STORAGE_KEY, resolved);
  return resolved;
}
