type PushDeliveryOutcome = "delivered" | "blocked" | "skipped" | "failed";
type PushDeliveryReason =
  | "push_not_configured"
  | "no_subscriptions"
  | "send_failed"
  | "send_succeeded";

export type PushDeliveryAttempt = {
  id: string;
  createdAt: string;
  outcome: PushDeliveryOutcome;
  reason: PushDeliveryReason;
  attempted: number;
  delivered: number;
};

export type PushDeliverySummary = {
  attempted: number;
  delivered: number;
  blocked: number;
  skipped: number;
  failed: number;
};

const MAX_ENTRIES = 50;
let attempts: PushDeliveryAttempt[] = [];

function buildId() {
  return `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordPushDeliveryAttempt(input: {
  outcome: PushDeliveryOutcome;
  reason: PushDeliveryReason;
  attempted: number;
  delivered: number;
  createdAt?: string;
}) {
  const entry: PushDeliveryAttempt = {
    id: buildId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    outcome: input.outcome,
    reason: input.reason,
    attempted: input.attempted,
    delivered: input.delivered,
  };
  attempts = [entry, ...attempts].slice(0, MAX_ENTRIES);
}

export function getPushDeliveryAttempts(limit = 20) {
  return attempts.slice(0, limit);
}

export function getPushDeliverySummary(limit = 20): PushDeliverySummary {
  const recent = getPushDeliveryAttempts(limit);
  return recent.reduce<PushDeliverySummary>(
    (acc, entry) => {
      acc.attempted += entry.attempted;
      acc.delivered += entry.delivered;
      if (entry.outcome === "blocked") acc.blocked += 1;
      if (entry.outcome === "skipped") acc.skipped += 1;
      if (entry.outcome === "failed") acc.failed += 1;
      return acc;
    },
    { attempted: 0, delivered: 0, blocked: 0, skipped: 0, failed: 0 }
  );
}

export function resetPushDeliveryTelemetry() {
  attempts = [];
}
