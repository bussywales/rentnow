export type PushDeliveryOutcome = {
  attempted: boolean;
  status: "sent" | "failed" | "skipped";
  error?: string;
  attemptedCount?: number;
  deliveredCount?: number;
  failedCount?: number;
};

const PUSH_UNAVAILABLE_PREFIX = "push_unavailable:";
const PUSH_FAILED_PREFIX = "push_failed:";
const PUSH_PRUNED_PREFIX = "push_pruned:";

export function formatPushUnavailable(reason: string) {
  return `${PUSH_UNAVAILABLE_PREFIX}${reason}`;
}

export function formatPushFailed(reason: string) {
  return `${PUSH_FAILED_PREFIX}${reason}`;
}

export function formatPushPruned(reason: string) {
  return `${PUSH_PRUNED_PREFIX}${reason}`;
}

export function getPushOutcomeMarker(outcome: PushDeliveryOutcome) {
  if (outcome.status === "sent") return "push_sent";
  if (outcome.status === "failed") {
    return outcome.error && outcome.error.startsWith(PUSH_FAILED_PREFIX)
      ? outcome.error
      : formatPushFailed("unknown");
  }
  if (!outcome.attempted) {
    return outcome.error && outcome.error.startsWith(PUSH_UNAVAILABLE_PREFIX)
      ? outcome.error
      : formatPushUnavailable("unknown");
  }
  return "push_attempted";
}
