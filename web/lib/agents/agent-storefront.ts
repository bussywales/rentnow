export type StorefrontAvailabilityReason =
  | "global_disabled"
  | "agent_disabled"
  | "not_found";

export type StorefrontAvailability =
  | { available: true }
  | { available: false; reason: StorefrontAvailabilityReason };

export function slugifyAgentName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function ensureUniqueSlug(base: string, existing: string[]): string {
  const normalizedBase = base.trim().toLowerCase() || "agent";
  const used = new Set(existing.map((slug) => slug.toLowerCase()));
  if (!used.has(normalizedBase)) return normalizedBase;
  let suffix = 2;
  while (used.has(`${normalizedBase}-${suffix}`)) {
    suffix += 1;
  }
  return `${normalizedBase}-${suffix}`;
}

export function resolveStorefrontAvailability(input: {
  globalEnabled: boolean;
  agentFound: boolean;
  agentEnabled: boolean | null | undefined;
}): StorefrontAvailability {
  if (!input.globalEnabled) {
    return { available: false, reason: "global_disabled" };
  }
  if (!input.agentFound) {
    return { available: false, reason: "not_found" };
  }
  if (input.agentEnabled === false) {
    return { available: false, reason: "agent_disabled" };
  }
  return { available: true };
}
