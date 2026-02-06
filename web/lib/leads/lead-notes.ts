import type { UserRole } from "@/lib/types";

export const LEAD_TAG_MAX_LENGTH = 32;

export function normalizeLeadTag(input: string): string | null {
  if (!input) return null;
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LEAD_TAG_MAX_LENGTH);

  return cleaned.length ? cleaned : null;
}

export function canAccessLeadNotes({
  role,
  userId,
  ownerId,
}: {
  role: UserRole | null;
  userId: string;
  ownerId: string;
}): boolean {
  if (role === "admin") return true;
  if ((role === "landlord" || role === "agent") && userId === ownerId) {
    return true;
  }
  return false;
}
