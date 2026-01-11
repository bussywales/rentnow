import { createHash, randomBytes } from "crypto";

const TOKEN_BYTES = 32;

export function buildShareToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function buildThreadId(propertyId: string, tenantId: string): string {
  const hash = createHash("sha256")
    .update(`${propertyId}:${tenantId}`)
    .digest("hex")
    .slice(0, 32);
  return formatUuidFromHex(hash);
}

export type ShareLinkStatus = "active" | "expired" | "revoked" | "invalid";

type ShareStatusInput = {
  expiresAt: string | Date;
  revokedAt?: string | Date | null;
  now?: Date;
};

export function isShareActive(input: {
  expiresAt: string | Date;
  revokedAt?: string | Date | null;
  now?: Date;
}): boolean {
  return resolveShareStatus(input, input.now) === "active";
}

export function resolveShareStatus(
  input: ShareStatusInput | null,
  nowOverride?: Date
): ShareLinkStatus {
  if (!input) return "invalid";
  if (input.revokedAt) return "revoked";
  const now = nowOverride ?? input.now ?? new Date();
  const expires = input.expiresAt instanceof Date
    ? input.expiresAt
    : new Date(input.expiresAt);
  if (expires.getTime() <= now.getTime()) {
    return "expired";
  }
  return "active";
}

export function getShareStatusCopy(status: ShareLinkStatus): {
  title: string;
  description: string;
  cta?: { href: string; label: string };
} {
  switch (status) {
    case "revoked":
      return {
        title: "Share link revoked",
        description: "This link was revoked by a participant.",
        cta: { href: "/dashboard/messages", label: "Back to messages" },
      };
    case "expired":
      return {
        title: "Share link expired",
        description: "This link has expired. Ask for a fresh share link.",
        cta: { href: "/dashboard/messages", label: "Back to messages" },
      };
    case "invalid":
      return {
        title: "Share link unavailable",
        description: "This link is invalid or you no longer have access.",
        cta: { href: "/support", label: "Contact support" },
      };
    case "active":
    default:
      return {
        title: "Shared thread",
        description: "Read-only link.",
      };
  }
}

function formatUuidFromHex(hex: string): string {
  const normalized = hex.padEnd(32, "0").slice(0, 32);
  return [
    normalized.slice(0, 8),
    normalized.slice(8, 12),
    normalized.slice(12, 16),
    normalized.slice(16, 20),
    normalized.slice(20),
  ].join("-");
}
