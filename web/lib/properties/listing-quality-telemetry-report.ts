import type { SupabaseClient } from "@supabase/supabase-js";
import type { PropertyEventRow } from "@/lib/analytics/property-events";

export type HostListingQualityTelemetryTargetStep = "basics" | "details" | "photos";

export type HostListingQualityTelemetrySnapshot = {
  range: {
    days: number;
    label: string;
    startIso: string;
    endIso: string;
  };
  guidanceViewed: number;
  fixClicked: number;
  clickThroughRate: number | null;
  submitAttempted: number;
  improvedBeforeSubmit: number;
  improvementRate: number | null;
  averageScoreDelta: number | null;
  byTargetStep: Array<{
    key: HostListingQualityTelemetryTargetStep;
    label: string;
    clicks: number;
  }>;
  error: string | null;
};

type HostListingQualityTelemetryRow = Pick<
  PropertyEventRow,
  "event_type" | "occurred_at" | "meta"
>;

const TARGET_STEPS: Array<{
  key: HostListingQualityTelemetryTargetStep;
  label: string;
}> = [
  { key: "basics", label: "Basics" },
  { key: "details", label: "Details" },
  { key: "photos", label: "Photos" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getNumber(meta: Record<string, unknown>, key: string) {
  const value = meta[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBoolean(meta: Record<string, unknown>, key: string) {
  return typeof meta[key] === "boolean" ? (meta[key] as boolean) : null;
}

function getString(meta: Record<string, unknown>, key: string) {
  return typeof meta[key] === "string" ? (meta[key] as string) : null;
}

function roundRate(value: number) {
  return Number(value.toFixed(2));
}

export function buildHostListingQualityTelemetrySnapshot(input: {
  rows: HostListingQualityTelemetryRow[];
  days?: number;
  now?: Date;
}): HostListingQualityTelemetrySnapshot {
  const days = input.days ?? 30;
  const now = input.now ?? new Date();
  const endIso = now.toISOString();
  const startIso = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  let guidanceViewed = 0;
  let fixClicked = 0;
  let submitAttempted = 0;
  let improvedBeforeSubmit = 0;
  let scoreDeltaTotal = 0;
  let scoreDeltaCount = 0;

  const clicksByStep = new Map<HostListingQualityTelemetryTargetStep, number>(
    TARGET_STEPS.map((item) => [item.key, 0])
  );

  for (const row of input.rows) {
    const meta = isRecord(row.meta) ? row.meta : {};

    if (row.event_type === "listing_quality_guidance_viewed") {
      guidanceViewed += 1;
      continue;
    }

    if (row.event_type === "listing_quality_fix_clicked") {
      fixClicked += 1;
      const targetStep = getString(meta, "target_step");
      if (targetStep === "basics" || targetStep === "details" || targetStep === "photos") {
        clicksByStep.set(targetStep, (clicksByStep.get(targetStep) ?? 0) + 1);
      }
      continue;
    }

    if (row.event_type !== "listing_submit_attempted") continue;

    if (getString(meta, "quality_source") !== "submit_step") continue;
    submitAttempted += 1;

    if (getBoolean(meta, "quality_score_improved") === true) {
      improvedBeforeSubmit += 1;
    }

    const scoreBefore = getNumber(meta, "quality_score_before");
    const scoreAtSubmit = getNumber(meta, "quality_score_at_submit");
    if (scoreBefore === null || scoreAtSubmit === null) continue;

    scoreDeltaTotal += scoreAtSubmit - scoreBefore;
    scoreDeltaCount += 1;
  }

  return {
    range: {
      days,
      label: `Last ${days} days`,
      startIso,
      endIso,
    },
    guidanceViewed,
    fixClicked,
    clickThroughRate:
      guidanceViewed > 0 ? roundRate((fixClicked / guidanceViewed) * 100) : null,
    submitAttempted,
    improvedBeforeSubmit,
    improvementRate:
      submitAttempted > 0 ? roundRate((improvedBeforeSubmit / submitAttempted) * 100) : null,
    averageScoreDelta:
      scoreDeltaCount > 0 ? roundRate(scoreDeltaTotal / scoreDeltaCount) : null,
    byTargetStep: TARGET_STEPS.map((item) => ({
      key: item.key,
      label: item.label,
      clicks: clicksByStep.get(item.key) ?? 0,
    })),
    error: null,
  };
}

export async function fetchHostListingQualityTelemetrySnapshot(params: {
  client: SupabaseClient;
  days?: number;
  now?: Date;
}): Promise<HostListingQualityTelemetrySnapshot> {
  const days = params.days ?? 30;
  const now = params.now ?? new Date();
  const startIso = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await params.client
    .from("property_events")
    .select("event_type, occurred_at, meta")
    .in("event_type", [
      "listing_quality_guidance_viewed",
      "listing_quality_fix_clicked",
      "listing_submit_attempted",
    ])
    .gte("occurred_at", startIso);

  if (error) {
    return {
      ...buildHostListingQualityTelemetrySnapshot({ rows: [], days, now }),
      error: error.message,
    };
  }

  return buildHostListingQualityTelemetrySnapshot({
    rows: (data as HostListingQualityTelemetryRow[]) ?? [],
    days,
    now,
  });
}
