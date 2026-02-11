const MIN_PUBLIC_SLUG_LENGTH = 3;
const MAX_PUBLIC_SLUG_LENGTH = 60;
const PUBLIC_SLUG_COOLDOWN_DAYS = 7;

const PUBLIC_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const BLOCKED_PUBLIC_SLUGS = [
  "admin",
  "support",
  "help",
  "api",
  "agents",
  "dashboard",
  "settings",
  "auth",
  "login",
  "signup",
  "terms",
  "privacy",
] as const;

export type PublicSlugValidationResult =
  | { ok: true; slug: string }
  | { ok: false; message: string };

export type PublicSlugCooldownResult =
  | { ok: true }
  | { ok: false; nextAllowedAt: string; message: string };

function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePublicSlugInput(value: unknown): string {
  return safeTrim(value).toLowerCase();
}

export function validatePublicSlugInput(value: unknown): PublicSlugValidationResult {
  const raw = safeTrim(value);
  if (!raw) {
    return { ok: false, message: "Enter a slug." };
  }
  if (raw !== raw.toLowerCase()) {
    return { ok: false, message: "Use lowercase letters only." };
  }
  if (raw.length < MIN_PUBLIC_SLUG_LENGTH || raw.length > MAX_PUBLIC_SLUG_LENGTH) {
    return {
      ok: false,
      message: `Slug must be ${MIN_PUBLIC_SLUG_LENGTH}-${MAX_PUBLIC_SLUG_LENGTH} characters.`,
    };
  }
  if (!PUBLIC_SLUG_REGEX.test(raw)) {
    return {
      ok: false,
      message: "Use letters, numbers, and single hyphens only (no leading or trailing hyphen).",
    };
  }
  if (BLOCKED_PUBLIC_SLUGS.includes(raw as (typeof BLOCKED_PUBLIC_SLUGS)[number])) {
    return { ok: false, message: "That slug is reserved. Choose another one." };
  }
  return { ok: true, slug: raw };
}

export function parseIsoDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function enforcePublicSlugCooldown(input: {
  lastChangedAt?: string | null;
  now?: Date;
  cooldownDays?: number;
}): PublicSlugCooldownResult {
  const parsed = parseIsoDate(input.lastChangedAt ?? null);
  if (!parsed) return { ok: true };
  const now = input.now ?? new Date();
  const cooldownDays = input.cooldownDays ?? PUBLIC_SLUG_COOLDOWN_DAYS;
  const windowMs = cooldownDays * 24 * 60 * 60 * 1000;
  const nextAllowedMs = parsed + windowMs;
  if (now.getTime() >= nextAllowedMs) return { ok: true };
  const nextAllowedAt = new Date(nextAllowedMs).toISOString();
  return {
    ok: false,
    nextAllowedAt,
    message: "You can change your public link once every 7 days.",
  };
}
