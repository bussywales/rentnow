import { canManageListings } from "@/lib/role-access";
import type { UserRole } from "@/lib/types";

type SearchParams = Record<string, string | string[] | undefined>;

export function buildQueryString(params: SearchParams): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (!entry) continue;
        query.append(key, entry);
      }
      continue;
    }

    if (!value) continue;
    query.set(key, value);
  }

  return query.toString();
}

export function normalizeShortletPropertyId(id: string | undefined): string | null {
  if (!id) return null;
  const normalized = decodeURIComponent(id).trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return null;
  }
  return normalized;
}

export function buildHostShortletSettingsHref(id: string, params: SearchParams): string {
  const base = `/host/shortlets/${encodeURIComponent(id)}/settings`;
  const query = buildQueryString(params);
  return query ? `${base}?${query}` : base;
}

export function resolveLegacyDashboardShortletSettingsRedirect(input: {
  userPresent: boolean;
  role: UserRole | null;
  propertyId: string | undefined;
  searchParams: SearchParams;
}): string {
  if (!input.userPresent) {
    return "/auth/login?reason=auth";
  }

  if (!input.role) {
    return "/onboarding";
  }

  if (!canManageListings(input.role)) {
    return "/tenant/home";
  }

  const cleanId = normalizeShortletPropertyId(input.propertyId);
  if (!cleanId) {
    return "/host/listings?view=manage";
  }

  return buildHostShortletSettingsHref(cleanId, input.searchParams);
}
