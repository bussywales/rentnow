import {
  DISCOVERY_INTENTS,
  DISCOVERY_KINDS,
  DISCOVERY_MARKETS,
  DISCOVERY_SURFACES,
} from "@/lib/discovery/market-taxonomy";
import type { DiscoveryCatalogueItem } from "@/lib/discovery/discovery-catalogue";

export type DiscoveryValidationResult = {
  items: DiscoveryCatalogueItem[];
  warnings: string[];
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SENSITIVE_TOKENS = [
  "race",
  "ethnicity",
  "religion",
  "tribe",
  "sexual orientation",
  "pregnant",
  "disability",
];

function isIsoDate(value: string | null | undefined): boolean {
  if (!value || !ISO_DATE_RE.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hasSensitiveToken(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  const token = SENSITIVE_TOKENS.find((candidate) => normalized.includes(candidate));
  return token ?? null;
}

function collectUnknownValues<T extends string>(values: readonly string[], allowed: readonly T[]): string[] {
  const allowedSet = new Set(allowed);
  return values.filter((value) => !allowedSet.has(value as T));
}

export function validateDiscoveryCatalogue(input: {
  items: ReadonlyArray<DiscoveryCatalogueItem>;
  now?: Date;
}): DiscoveryValidationResult {
  const dateKey = toDateKey(input.now ?? new Date());
  const warnings: string[] = [];
  const valid: DiscoveryCatalogueItem[] = [];
  const seenIds = new Set<string>();

  for (const item of input.items) {
    if (!item || typeof item !== "object") {
      warnings.push("Skipping invalid discovery item: non-object entry.");
      continue;
    }
    if (!item.id || typeof item.id !== "string") {
      warnings.push("Skipping invalid discovery item: missing string id.");
      continue;
    }
    if (seenIds.has(item.id)) {
      warnings.push(`Skipping invalid discovery item "${item.id}": duplicate id.`);
      continue;
    }
    seenIds.add(item.id);

    if (!item.title?.trim()) {
      warnings.push(`Skipping invalid discovery item "${item.id}": missing title.`);
      continue;
    }
    if (!item.kind || !DISCOVERY_KINDS.includes(item.kind)) {
      warnings.push(`Skipping invalid discovery item "${item.id}": invalid kind.`);
      continue;
    }
    if (!item.intent || !DISCOVERY_INTENTS.includes(item.intent)) {
      warnings.push(`Skipping invalid discovery item "${item.id}": invalid intent.`);
      continue;
    }
    if (!Array.isArray(item.marketTags) || item.marketTags.length === 0) {
      warnings.push(`Skipping invalid discovery item "${item.id}": marketTags cannot be empty.`);
      continue;
    }
    const unknownMarkets = collectUnknownValues(item.marketTags, DISCOVERY_MARKETS);
    if (unknownMarkets.length > 0) {
      warnings.push(
        `Skipping invalid discovery item "${item.id}": unknown market tags ${unknownMarkets.join(", ")}.`
      );
      continue;
    }
    if (!Array.isArray(item.surfaces) || item.surfaces.length === 0) {
      warnings.push(`Skipping invalid discovery item "${item.id}": surfaces cannot be empty.`);
      continue;
    }
    const unknownSurfaces = collectUnknownValues(item.surfaces, DISCOVERY_SURFACES);
    if (unknownSurfaces.length > 0) {
      warnings.push(
        `Skipping invalid discovery item "${item.id}": unknown surfaces ${unknownSurfaces.join(", ")}.`
      );
      continue;
    }
    if (!item.params || typeof item.params !== "object" || Array.isArray(item.params)) {
      warnings.push(`Skipping invalid discovery item "${item.id}": params must be a key/value record.`);
      continue;
    }
    if (!Number.isFinite(item.priority)) {
      warnings.push(`Skipping invalid discovery item "${item.id}": priority must be numeric.`);
      continue;
    }
    if (item.validFrom && !isIsoDate(item.validFrom)) {
      warnings.push(`Skipping invalid discovery item "${item.id}": invalid validFrom date.`);
      continue;
    }
    if (item.validTo && !isIsoDate(item.validTo)) {
      warnings.push(`Skipping invalid discovery item "${item.id}": invalid validTo date.`);
      continue;
    }
    if (item.validFrom && item.validTo && item.validFrom > item.validTo) {
      warnings.push(`Skipping invalid discovery item "${item.id}": validFrom is later than validTo.`);
      continue;
    }
    const titleToken = hasSensitiveToken(item.title);
    if (titleToken) {
      warnings.push(`Skipping invalid discovery item "${item.id}": restricted token "${titleToken}" in title.`);
      continue;
    }
    const subtitleToken = hasSensitiveToken(item.subtitle);
    if (subtitleToken) {
      warnings.push(
        `Skipping invalid discovery item "${item.id}": restricted token "${subtitleToken}" in subtitle.`
      );
      continue;
    }

    if (item.disabled) continue;
    if (item.validFrom && dateKey < item.validFrom) continue;
    if (item.validTo && dateKey > item.validTo) continue;

    valid.push(item);
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== "production") {
    for (const warning of warnings) {
      console.warn(`[discovery-catalogue] ${warning}`);
    }
  }

  return { items: valid, warnings };
}
