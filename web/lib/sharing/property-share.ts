import { buildShareToken, resolveShareStatus, type ShareLinkStatus } from "@/lib/messaging/share";
import type { UserRole } from "@/lib/types";

export type PropertyShareRow = {
  expires_at: string | null;
  revoked_at: string | null;
};

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
