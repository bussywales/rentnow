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

export function normalizePropertyId(id: string | undefined): string | null {
  if (!id) return null;
  const normalized = decodeURIComponent(id).trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return null;
  }
  return normalized;
}

export function buildHostPropertyAvailabilityHref(id: string, params: SearchParams): string {
  const cleanId = encodeURIComponent(id);
  const query = buildQueryString(params);
  // Availability is the closest host-native management route for listing-specific operations.
  const base = `/host/properties/${cleanId}/availability`;
  return query ? `${base}?${query}` : base;
}

export function resolveLegacyDashboardPropertyRedirect(input: {
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

  const cleanId = normalizePropertyId(input.propertyId);
  if (!cleanId) {
    return "/host/listings?view=manage";
  }

  return buildHostPropertyAvailabilityHref(cleanId, input.searchParams);
}
