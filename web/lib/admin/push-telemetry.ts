import { getPushOutcomeMarker, type PushDeliveryOutcome } from "@/lib/push/outcomes";

export type PushAlertRow = {
  id: string;
  user_id: string;
  property_id?: string | null;
  channel?: string | null;
  status?: string | null;
  error?: string | null;
  created_at?: string | null;
};

export type PushFailureEntry = {
  reason: string;
  count: number;
};

export type PushTelemetrySummary = {
  sampleSize: number;
  pushAttempted: number;
  pushSucceeded: number;
  topFailureReasons: PushFailureEntry[];
  recent: PushAlertRow[];
};

function buildFailureCounts(reasons: string[], maxItems: number) {
  const counts = new Map<string, number>();
  reasons.forEach((reason) => {
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxItems);
}

function isPushAttempted(row: PushAlertRow) {
  return (row.channel || "").includes("push");
}

function isPushFailed(row: PushAlertRow) {
  return (row.error || "").includes("push_failed:");
}

export function derivePushOutcomeMarker(row: PushAlertRow) {
  const error = row.error ?? "";
  const errorParts = error
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const marker = errorParts.find(
    (part) => part.startsWith("push_unavailable:") || part.startsWith("push_failed:")
  );
  if (marker) {
    return marker;
  }

  if (isPushAttempted(row) && row.status === "sent" && !isPushFailed(row)) {
    return getPushOutcomeMarker({ attempted: true, status: "sent" });
  }

  if (isPushAttempted(row)) {
    const outcome: PushDeliveryOutcome = {
      attempted: true,
      status: "failed",
    };
    return getPushOutcomeMarker(outcome);
  }

  return getPushOutcomeMarker({ attempted: false, status: "skipped" });
}

export function buildPushTelemetrySummary(
  rows: PushAlertRow[],
  maxItems = 6
): PushTelemetrySummary {
  const pushRows = rows.filter(isPushAttempted);
  const pushSucceeded = pushRows.filter(
    (row) => row.status === "sent" && !isPushFailed(row)
  ).length;

  const failureReasons = pushRows
    .map((row) => derivePushOutcomeMarker(row))
    .filter((marker) => marker.startsWith("push_failed:") || marker.startsWith("push_unavailable:"));

  return {
    sampleSize: rows.length,
    pushAttempted: pushRows.length,
    pushSucceeded,
    topFailureReasons: buildFailureCounts(failureReasons, maxItems),
    recent: pushRows.slice(0, 6),
  };
}
