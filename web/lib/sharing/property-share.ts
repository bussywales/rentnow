import { buildShareToken, resolveShareStatus, type ShareLinkStatus } from "@/lib/messaging/share";
import type { UserRole } from "@/lib/types";

export type PropertyShareRow = {
  expires_at: string | null;
  revoked_at: string | null;
};

export type PropertyShareRedirectParams = Partial<{
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
}>;

const ALLOWED_REDIRECT_QUERY_KEYS = [
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export function buildPropertyShareToken(): string {
  return buildShareToken();
}

export function resolvePropertyShareStatus(input: PropertyShareRow | null): ShareLinkStatus {
  if (!input) return "invalid";
  if (!input.expires_at) {
    return input.revoked_at ? "revoked" : "active";
  }
  return resolveShareStatus({
    expiresAt: input.expires_at,
    revokedAt: input.revoked_at ?? null,
  });
}

export function canManagePropertyShare(input: {
  role: UserRole | null;
  userId: string;
  ownerId: string | null;
}): boolean {
  if (!input.role) return false;
  if (input.role === "admin") return true;
  if ((input.role === "landlord" || input.role === "agent") && input.ownerId) {
    return input.userId === input.ownerId;
  }
  return false;
}

export function formatPropertyShareExpiry(expiresAt?: string | null): string {
  if (!expiresAt) return "No expiry";
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return "No expiry";
  return `Expires ${parsed.toLocaleString()}`;
}

export function buildPropertyShareRedirect(propertyId: string, params?: PropertyShareRedirectParams): string {
  const searchParams = new URLSearchParams({ shared: "1" });
  for (const key of ALLOWED_REDIRECT_QUERY_KEYS) {
    const value = params?.[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    searchParams.set(key, trimmed);
  }
  return `/properties/${encodeURIComponent(propertyId)}?${searchParams.toString()}`;
}
