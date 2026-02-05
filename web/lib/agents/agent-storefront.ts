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

export function shouldEnsureAgentSlug(input: {
  enabled: boolean;
  slug?: string | null;
}): boolean {
  return input.enabled && !safeTrim(input.slug);
}

export function resolveAgentSlugBase(input: {
  currentSlug?: string | null;
  displayName?: string | null;
  fullName?: string | null;
  businessName?: string | null;
  userId?: string | null;
}): string {
  const existing = safeTrim(input.currentSlug);
  if (existing) return existing;
  const base =
    slugifyAgentName(input.displayName) ||
    slugifyAgentName(input.fullName) ||
    slugifyAgentName(input.businessName);
  if (base) return base;
  if (input.userId) return `agent-${input.userId.slice(0, 8)}`;
  return "agent";
}

export function resolveLegacySlugRedirect(input: {
  requestedSlug: string;
  profile: {
    agent_slug?: string | null;
    display_name?: string | null;
    full_name?: string | null;
    business_name?: string | null;
  };
}): string | null {
  const requested = safeTrim(input.requestedSlug).toLowerCase();
  const stored = safeTrim(input.profile.agent_slug).toLowerCase();
  if (!requested || !stored || requested === stored) return null;
  const computed =
    slugifyAgentName(input.profile.display_name) ||
    slugifyAgentName(input.profile.full_name) ||
    slugifyAgentName(input.profile.business_name);
  if (!computed) return null;
  return computed === requested ? input.profile.agent_slug ?? null : null;
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
