import type { MessagingPermissionCode } from "@/lib/messaging/permissions";

export type ThrottleTelemetryRow = {
  actor_profile_id: string;
  thread_key: string;
  property_id: string | null;
  recipient_profile_id: string | null;
  reason_code: "rate_limited";
  retry_after_seconds: number | null;
  window_seconds: number | null;
  limit: number | null;
  mode: string | null;
  ip_hash: string | null;
};

type TelemetryInsertResponse = {
  error?: { message: string } | null;
};

type TelemetryInsertPromise = PromiseLike<TelemetryInsertResponse>;

export type TelemetryInsertClient = {
  from: (table: string) => {
    insert: (payload: ThrottleTelemetryRow) => TelemetryInsertPromise;
  };
};

export function buildThrottleThreadKey(input: {
  propertyId?: string | null;
  recipientId?: string | null;
  senderId?: string | null;
}): string {
  if (input.propertyId && input.recipientId) {
    return `${input.propertyId}:${input.recipientId}`;
  }
  if (input.senderId && input.recipientId) {
    return `${input.senderId}:${input.recipientId}`;
  }
  return "unknown";
}

export function buildThrottleTelemetryRow(input: {
  actorProfileId: string;
  threadKey: string;
  propertyId?: string | null;
  recipientProfileId?: string | null;
  retryAfterSeconds?: number | null;
  windowSeconds?: number | null;
  limit?: number | null;
  mode?: string | null;
  ipHash?: string | null;
}): ThrottleTelemetryRow {
  return {
    actor_profile_id: input.actorProfileId,
    thread_key: input.threadKey,
    property_id: input.propertyId ?? null,
    recipient_profile_id: input.recipientProfileId ?? null,
    reason_code: "rate_limited",
    retry_after_seconds: input.retryAfterSeconds ?? null,
    window_seconds: input.windowSeconds ?? null,
    limit: input.limit ?? null,
    mode: input.mode ?? null,
    ip_hash: input.ipHash ?? null,
  };
}

export async function recordThrottleTelemetryEvent(input: {
  client: TelemetryInsertClient;
  code: MessagingPermissionCode;
  row: ThrottleTelemetryRow;
}) {
  if (input.code !== "rate_limited") {
    return { ok: false, skipped: true };
  }
  const { error } = await input.client
    .from("messaging_throttle_events")
    .insert(input.row);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
