export type HostWorkspaceSection = "listings" | "bookings";

export function isBookingsTargetFromLocation(input: {
  tab?: string | null;
  hash?: string | null;
}) {
  const tab = (input.tab || "").trim().toLowerCase();
  if (tab === "bookings") return true;

  const hash = (input.hash || "").replace(/^#/, "").trim().toLowerCase();
  return hash === "host-bookings";
}

export function resolveHostWorkspaceSectionFromLocation(
  current: HostWorkspaceSection,
  input: {
    tab?: string | null;
    hash?: string | null;
  }
): HostWorkspaceSection {
  if (isBookingsTargetFromLocation(input)) return "bookings";

  const tab = (input.tab || "").trim().toLowerCase();
  if (tab === "listings") return "listings";

  return current;
}
