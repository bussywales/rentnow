import {
  DISCOVERY_INTENTS,
  DISCOVERY_KINDS,
  DISCOVERY_MARKETS,
  DISCOVERY_SURFACES,
} from "@/lib/discovery/market-taxonomy";
import type { DiscoveryCatalogueItem } from "@/lib/discovery/discovery-catalogue";

export const DISCOVERY_VALIDATION_REASON_CODES = [
  "NON_OBJECT_ENTRY",
  "MISSING_ID",
  "DUPLICATE_ID",
  "MISSING_TITLE",
  "MISSING_KIND",
  "MISSING_INTENT",
  "EMPTY_MARKET_TAGS",
  "INVALID_MARKET_TAG",
  "EMPTY_SURFACES",
  "INVALID_SURFACE",
  "MISSING_PARAMS",
  "INVALID_PRIORITY",
  "INVALID_VALID_FROM",
  "INVALID_VALID_TO",
  "INVALID_DATE_RANGE",
  "SENSITIVE_TOKEN",
  "MISSING_REQUIRED_PARAM_FOR_KIND",
  "DISABLED",
  "NOT_YET_ACTIVE",
  "EXPIRED",
] as const;

export type DiscoveryValidationReasonCode = (typeof DISCOVERY_VALIDATION_REASON_CODES)[number];

export type DiscoveryValidationIssue = {
  id: string | null;
  reasonCodes: DiscoveryValidationReasonCode[];
  details: string;
};

export type DiscoveryValidationDiagnostics = {
  totalInput: number;
  validCount: number;
  invalidCount: number;
  disabledCount: number;
  notYetActiveCount: number;
  expiredCount: number;
  issues: DiscoveryValidationIssue[];
};

export type DiscoveryValidationResult = {
  items: DiscoveryCatalogueItem[];
  warnings: string[];
  diagnostics?: DiscoveryValidationDiagnostics;
};

type ValidationMode = "runtime" | "diagnostics";

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

function hasRequiredParamsForKind(item: DiscoveryCatalogueItem): boolean {
  const params = item.params ?? {};
  if (item.kind === "shortlet") {
    return Object.keys(params).length > 0;
  }
  if (item.kind === "property") {
    return Boolean(params.intent || params.category);
  }
  return true;
}

function toWarningMessage(
  id: string | null,
  reasonCode: DiscoveryValidationReasonCode,
  details: string
): string {
  if (reasonCode === "NON_OBJECT_ENTRY") {
    return "Skipping invalid discovery item: non-object entry.";
  }
  const resolvedId = id ?? "unknown";
  return `Skipping invalid discovery item "${resolvedId}": ${details}`;
}

export function validateDiscoveryCatalogue(input: {
  items: ReadonlyArray<DiscoveryCatalogueItem>;
  now?: Date;
  mode?: ValidationMode;
}): DiscoveryValidationResult {
  const mode = input.mode ?? "runtime";
  const dateKey = toDateKey(input.now ?? new Date());
  const warnings: string[] = [];
  const valid: DiscoveryCatalogueItem[] = [];
  const seenIds = new Set<string>();
  const issues: DiscoveryValidationIssue[] = [];
  let disabledCount = 0;
  let notYetActiveCount = 0;
  let expiredCount = 0;

  function addIssue(
    id: string | null,
    reasonCode: DiscoveryValidationReasonCode,
    details: string,
    options?: { addWarning?: boolean }
  ) {
    issues.push({
      id,
      reasonCodes: [reasonCode],
      details,
    });
    if (options?.addWarning !== false) {
      warnings.push(toWarningMessage(id, reasonCode, details));
    }
  }

  for (const item of input.items) {
    if (!item || typeof item !== "object") {
      addIssue(null, "NON_OBJECT_ENTRY", "non-object entry");
      continue;
    }
    if (!item.id || typeof item.id !== "string") {
      addIssue(null, "MISSING_ID", "missing string id");
      continue;
    }
    if (seenIds.has(item.id)) {
      addIssue(item.id, "DUPLICATE_ID", "duplicate id");
      continue;
    }
    seenIds.add(item.id);

    if (!item.title?.trim()) {
      addIssue(item.id, "MISSING_TITLE", "missing title");
      continue;
    }
    if (!item.kind || !DISCOVERY_KINDS.includes(item.kind)) {
      addIssue(item.id, "MISSING_KIND", "invalid kind");
      continue;
    }
    if (!item.intent || !DISCOVERY_INTENTS.includes(item.intent)) {
      addIssue(item.id, "MISSING_INTENT", "invalid intent");
      continue;
    }
    if (!Array.isArray(item.marketTags) || item.marketTags.length === 0) {
      addIssue(item.id, "EMPTY_MARKET_TAGS", "marketTags cannot be empty");
      continue;
    }
    const unknownMarkets = collectUnknownValues(item.marketTags, DISCOVERY_MARKETS);
    if (unknownMarkets.length > 0) {
      addIssue(item.id, "INVALID_MARKET_TAG", `unknown market tags ${unknownMarkets.join(", ")}`);
      continue;
    }
    if (!Array.isArray(item.surfaces) || item.surfaces.length === 0) {
      addIssue(item.id, "EMPTY_SURFACES", "surfaces cannot be empty");
      continue;
    }
    const unknownSurfaces = collectUnknownValues(item.surfaces, DISCOVERY_SURFACES);
    if (unknownSurfaces.length > 0) {
      addIssue(item.id, "INVALID_SURFACE", `unknown surfaces ${unknownSurfaces.join(", ")}`);
      continue;
    }
    if (!item.params || typeof item.params !== "object" || Array.isArray(item.params)) {
      addIssue(item.id, "MISSING_PARAMS", "params must be a key/value record");
      continue;
    }
    if (!Number.isFinite(item.priority)) {
      addIssue(item.id, "INVALID_PRIORITY", "priority must be numeric");
      continue;
    }
    if (item.validFrom && !isIsoDate(item.validFrom)) {
      addIssue(item.id, "INVALID_VALID_FROM", "invalid validFrom date");
      continue;
    }
    if (item.validTo && !isIsoDate(item.validTo)) {
      addIssue(item.id, "INVALID_VALID_TO", "invalid validTo date");
      continue;
    }
    if (item.validFrom && item.validTo && item.validFrom > item.validTo) {
      addIssue(item.id, "INVALID_DATE_RANGE", "validFrom is later than validTo");
      continue;
    }
    const titleToken = hasSensitiveToken(item.title);
    if (titleToken) {
      addIssue(item.id, "SENSITIVE_TOKEN", `restricted token "${titleToken}" in title`);
      continue;
    }
    const subtitleToken = hasSensitiveToken(item.subtitle);
    if (subtitleToken) {
      addIssue(item.id, "SENSITIVE_TOKEN", `restricted token "${subtitleToken}" in subtitle`);
      continue;
    }
    if (!hasRequiredParamsForKind(item)) {
      addIssue(item.id, "MISSING_REQUIRED_PARAM_FOR_KIND", "missing required params for kind/intent");
      continue;
    }

    if (item.disabled) {
      disabledCount += 1;
      if (mode === "diagnostics") {
        addIssue(item.id, "DISABLED", "disabled", { addWarning: false });
      }
      continue;
    }
    if (item.validFrom && dateKey < item.validFrom) {
      notYetActiveCount += 1;
      if (mode === "diagnostics") {
        addIssue(item.id, "NOT_YET_ACTIVE", `starts at ${item.validFrom}`, { addWarning: false });
      }
      continue;
    }
    if (item.validTo && dateKey > item.validTo) {
      expiredCount += 1;
      if (mode === "diagnostics") {
        addIssue(item.id, "EXPIRED", `expired at ${item.validTo}`, { addWarning: false });
      }
      continue;
    }

    valid.push(item);
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== "production") {
    for (const warning of warnings) {
      console.warn(`[discovery-catalogue] ${warning}`);
    }
  }

  if (mode === "diagnostics") {
    return {
      items: valid,
      warnings,
      diagnostics: {
        totalInput: input.items.length,
        validCount: valid.length,
        invalidCount: issues.length - disabledCount - notYetActiveCount - expiredCount,
        disabledCount,
        notYetActiveCount,
        expiredCount,
        issues,
      },
    };
  }

  return { items: valid, warnings };
}
