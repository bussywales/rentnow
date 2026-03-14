import type {
  ListingCompletenessMissingFlag,
  ListingPublishReadinessStep,
} from "@/lib/properties/listing-quality";

export const LISTING_QUALITY_TELEMETRY_EVENT_TYPES = [
  "listing_quality_guidance_viewed",
  "listing_quality_fix_clicked",
] as const;

export type ListingQualityTelemetryEventType =
  (typeof LISTING_QUALITY_TELEMETRY_EVENT_TYPES)[number];

export type ListingQualityTelemetrySource = "submit_step";

export type ListingQualityGuidanceTelemetry = {
  source: ListingQualityTelemetrySource;
  bestNextFixKey: ListingCompletenessMissingFlag | null;
  scoreBefore: number;
  missingCountBefore: number;
};

export type ListingQualityFixClickTelemetry = ListingQualityGuidanceTelemetry & {
  clickedFixKey: ListingCompletenessMissingFlag;
  targetStep: ListingPublishReadinessStep;
};

export type ListingQualitySubmitTelemetry = ListingQualityGuidanceTelemetry & {
  scoreAtSubmit: number;
  scoreImproved: boolean;
  missingCountAtSubmit: number;
};

const VALID_MISSING_FLAGS = new Set<ListingCompletenessMissingFlag>([
  "missing_title",
  "weak_title",
  "missing_cover",
  "missing_images",
  "missing_description",
  "missing_price",
  "missing_location",
]);

const VALID_TARGET_STEPS = new Set<ListingPublishReadinessStep>([
  "basics",
  "details",
  "photos",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(20, Math.round(value)));
}

function normalizeMissingFlag(value: unknown): ListingCompletenessMissingFlag | null {
  if (typeof value !== "string") return null;
  return VALID_MISSING_FLAGS.has(value as ListingCompletenessMissingFlag)
    ? (value as ListingCompletenessMissingFlag)
    : null;
}

function normalizeTargetStep(value: unknown): ListingPublishReadinessStep | null {
  if (typeof value !== "string") return null;
  return VALID_TARGET_STEPS.has(value as ListingPublishReadinessStep)
    ? (value as ListingPublishReadinessStep)
    : null;
}

function normalizeSource(value: unknown): ListingQualityTelemetrySource | null {
  return value === "submit_step" ? "submit_step" : null;
}

function normalizeGuidanceBase(input: unknown): ListingQualityGuidanceTelemetry | null {
  if (!isRecord(input)) return null;
  const source = normalizeSource(input.source);
  const scoreBefore = normalizeScore(input.scoreBefore);
  const missingCountBefore = normalizeCount(input.missingCountBefore);
  const bestNextFixKey =
    input.bestNextFixKey == null ? null : normalizeMissingFlag(input.bestNextFixKey);

  if (!source || scoreBefore === null || missingCountBefore === null) return null;
  if (input.bestNextFixKey != null && bestNextFixKey === null) return null;

  return {
    source,
    bestNextFixKey,
    scoreBefore,
    missingCountBefore,
  };
}

export function normalizeListingQualityGuidanceTelemetry(
  input: unknown
): ListingQualityGuidanceTelemetry | null {
  return normalizeGuidanceBase(input);
}

export function normalizeListingQualityFixClickTelemetry(
  input: unknown
): ListingQualityFixClickTelemetry | null {
  const base = normalizeGuidanceBase(input);
  if (!base || !isRecord(input)) return null;

  const clickedFixKey = normalizeMissingFlag(input.clickedFixKey);
  const targetStep = normalizeTargetStep(input.targetStep);
  if (!clickedFixKey || !targetStep) return null;

  return {
    ...base,
    clickedFixKey,
    targetStep,
  };
}

export function normalizeListingQualitySubmitTelemetry(
  input: unknown
): ListingQualitySubmitTelemetry | null {
  const base = normalizeGuidanceBase(input);
  if (!base || !isRecord(input)) return null;

  const scoreAtSubmit = normalizeScore(input.scoreAtSubmit);
  const missingCountAtSubmit = normalizeCount(input.missingCountAtSubmit);
  if (scoreAtSubmit === null || missingCountAtSubmit === null) return null;
  if (typeof input.scoreImproved !== "boolean") return null;

  return {
    ...base,
    scoreAtSubmit,
    scoreImproved: input.scoreImproved,
    missingCountAtSubmit,
  };
}

export async function sendListingQualityTelemetry(params: {
  propertyId: string;
  eventType: ListingQualityTelemetryEventType;
  payload: ListingQualityGuidanceTelemetry | ListingQualityFixClickTelemetry;
}) {
  await fetch(`/api/properties/${params.propertyId}/quality-guidance`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventType: params.eventType,
      payload: params.payload,
    }),
  });
}
