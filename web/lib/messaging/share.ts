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

export function isShareActive(input: {
  expiresAt: string | Date;
  revokedAt?: string | Date | null;
  now?: Date;
}): boolean {
  if (input.revokedAt) return false;
  const now = input.now ?? new Date();
  const expires = input.expiresAt instanceof Date
    ? input.expiresAt
    : new Date(input.expiresAt);
  return expires.getTime() > now.getTime();
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
