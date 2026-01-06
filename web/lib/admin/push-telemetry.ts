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
  const attempted = isPushAttempted(row);
  let status: PushDeliveryOutcome["status"] = "skipped";
  if (attempted) {
    status = row.status === "sent" && !isPushFailed(row) ? "sent" : "failed";
  }
  const outcome: PushDeliveryOutcome = {
    attempted,
    status,
    error: row.error ?? undefined,
  };
  return getPushOutcomeMarker(outcome);
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
