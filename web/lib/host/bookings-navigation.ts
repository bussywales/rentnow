export type HostWorkspaceSection = "listings" | "bookings";

type HostWorkspaceLocationInput = {
  tab?: string | null;
  section?: string | null;
  hash?: string | null;
  booking?: string | null;
};

function normalizeSectionParam(value: string | null | undefined): HostWorkspaceSection | null {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "bookings") return "bookings";
  if (normalized === "listings") return "listings";
  return null;
}

export function resolveHostWorkspaceParam(
  input: HostWorkspaceLocationInput
): HostWorkspaceSection | null {
  return normalizeSectionParam(input.tab) ?? normalizeSectionParam(input.section) ?? null;
}

export function isBookingsTargetFromLocation(input: {
  tab?: string | null;
  section?: string | null;
  hash?: string | null;
  booking?: string | null;
}) {
  const sectionParam = resolveHostWorkspaceParam(input);
  if (sectionParam === "bookings") return true;
  if (String(input.booking || "").trim()) return true;

  const hash = (input.hash || "").replace(/^#/, "").trim().toLowerCase();
  return hash === "host-bookings";
}

export function resolveHostWorkspaceSectionFromLocation(
  current: HostWorkspaceSection,
  input: {
    tab?: string | null;
    section?: string | null;
    hash?: string | null;
    booking?: string | null;
  }
): HostWorkspaceSection {
  const sectionParam = resolveHostWorkspaceParam(input);
  if (sectionParam) return sectionParam;

  if (isBookingsTargetFromLocation(input)) return "bookings";

  return current;
}
