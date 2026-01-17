import type { UserRole } from "@/lib/types";

const LISTING_ROLES: UserRole[] = ["landlord", "agent", "admin"];

export type ListingCta = {
  label: string;
  href: string;
};

export type ListingAccessResult =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 403;
      code: "not_authenticated" | "role_not_allowed";
      message: string;
    };

export function canManageListings(role: UserRole | null): boolean {
  return !!role && LISTING_ROLES.includes(role);
}

export function shouldShowSavedSearchNav(role: UserRole | null): boolean {
  return role !== null;
}

export function getListingCta(role: UserRole | null): ListingCta {
  if (!role) {
    return { label: "List a property", href: "/auth/login?reason=auth" };
  }
  if (role === "tenant") {
    return { label: "Find a home", href: "/properties" };
  }
  return { label: "List a property", href: "/dashboard/properties/new" };
}

export function getListingAccessResult(
  role: UserRole | null,
  isAuthenticated: boolean
): ListingAccessResult {
  if (!isAuthenticated) {
    return {
      ok: false,
      status: 401,
      code: "not_authenticated",
      message: "Please log in to manage listings.",
    };
  }
  if (!canManageListings(role)) {
    return {
      ok: false,
      status: 403,
      code: "role_not_allowed",
      message: "Tenants can't list properties.",
    };
  }
  return { ok: true };
}
