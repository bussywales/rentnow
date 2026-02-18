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

function appendQueryValue(params: URLSearchParams, key: string, value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = String(item || "").trim();
      if (normalized) params.append(key, normalized);
    }
    return;
  }
  const normalized = String(value || "").trim();
  if (normalized) params.set(key, normalized);
}

export function buildHostBookingsHref(input?: {
  view?: string | null;
  booking?: string | null;
  hash?: string | null;
}) {
  const params = new URLSearchParams();
  const view = String(input?.view || "").trim();
  const booking = String(input?.booking || "").trim();
  if (view) params.set("view", view);
  if (booking) params.set("booking", booking);
  const query = params.toString();
  const hash = String(input?.hash || "").trim().replace(/^#/, "");
  const hashSuffix = hash ? `#${hash}` : "";
  return `/host/bookings${query ? `?${query}` : ""}${hashSuffix}`;
}

export function buildCanonicalHostBookingsHrefFromSearchParams(
  params: Record<string, string | string[] | undefined>,
  options?: { defaultView?: string | null }
) {
  const next = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(params)) {
    if (key === "tab" || key === "section") continue;
    appendQueryValue(next, key, rawValue);
  }

  const defaultView = String(options?.defaultView || "").trim();
  if (defaultView && !next.get("view")) {
    next.set("view", defaultView);
  }

  const query = next.toString();
  return `/host/bookings${query ? `?${query}` : ""}`;
}
