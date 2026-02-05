export type StorefrontFailureReason =
  | "GLOBAL_DISABLED"
  | "AGENT_DISABLED"
  | "NOT_FOUND"
  | "NOT_AGENT"
  | "MISSING_SLUG";

export type StorefrontResolution = { ok: true } | { ok: false; reason: StorefrontFailureReason };

export function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function slugifyAgentName(value: unknown): string {
  const trimmed = safeTrim(value);
  if (!trimmed) return "";
  return trimmed
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function ensureUniqueSlug(base: unknown, existing: string[]): string {
  const normalizedBase = safeTrim(base).toLowerCase() || "agent";
  const used = new Set(existing.map((slug) => slug.toLowerCase()));
  if (!used.has(normalizedBase)) return normalizedBase;
  let suffix = 2;
  while (used.has(`${normalizedBase}-${suffix}`)) {
    suffix += 1;
  }
  return `${normalizedBase}-${suffix}`;
}

export function resolveStorefrontAccess(input: {
  slug: unknown;
  globalEnabled: boolean;
  agentFound: boolean;
  agentRole?: string | null;
  agentEnabled: boolean | null | undefined;
}): StorefrontResolution {
  if (!input.globalEnabled) {
    return { ok: false, reason: "GLOBAL_DISABLED" };
  }
  const normalizedSlug = safeTrim(input.slug);
  if (!normalizedSlug) {
    return { ok: false, reason: "MISSING_SLUG" };
  }
  if (!input.agentFound) {
    return { ok: false, reason: "NOT_FOUND" };
  }
  if (input.agentEnabled === false) {
    return { ok: false, reason: "AGENT_DISABLED" };
  }
  if (input.agentRole !== "agent") {
    return { ok: false, reason: "NOT_AGENT" };
  }
  return { ok: true };
}
