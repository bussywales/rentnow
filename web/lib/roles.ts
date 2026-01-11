import type { UserRole } from "@/lib/types";

export const ROLE_VALUES = ["tenant", "landlord", "agent", "admin"] as const;
export type KnownRole = (typeof ROLE_VALUES)[number];

export function normalizeRole(value?: string | null): KnownRole | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return (ROLE_VALUES as readonly string[]).includes(normalized)
    ? (normalized as KnownRole)
    : null;
}

export function formatRoleLabel(value?: string | null): string {
  const role = normalizeRole(value);
  if (!role) return "Incomplete";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function formatRoleStatus(
  roleValue?: string | null,
  onboardingCompleted?: boolean | null
): string {
  const role = normalizeRole(roleValue);
  const completionKnown = typeof onboardingCompleted === "boolean";
  const isComplete = completionKnown ? onboardingCompleted : !!role;
  if (!role || !isComplete) return "Incomplete";
  return formatRoleLabel(role);
}

export function isAdminRole(value?: string | null): boolean {
  return normalizeRole(value) === "admin";
}

export function isKnownRole(value?: string | null): value is UserRole {
  return normalizeRole(value) !== null;
}
