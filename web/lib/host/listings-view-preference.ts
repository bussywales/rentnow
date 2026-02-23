export const HOST_LISTINGS_VIEW_STORAGE_KEY = "host:home:listingsView:v1";

export type HostListingsView = "grid" | "rail";

export function parseHostListingsView(value: string | null | undefined): HostListingsView {
  if (value === "rail") return "rail";
  return "grid";
}

export function readHostListingsView(storage: Pick<Storage, "getItem"> | null | undefined): HostListingsView {
  if (!storage) return "grid";
  return parseHostListingsView(storage.getItem(HOST_LISTINGS_VIEW_STORAGE_KEY));
}

export function writeHostListingsView(
  storage: Pick<Storage, "setItem"> | null | undefined,
  view: HostListingsView
): HostListingsView {
  const resolved = parseHostListingsView(view);
  storage?.setItem(HOST_LISTINGS_VIEW_STORAGE_KEY, resolved);
  return resolved;
}
