import { resolveShareStatus, type ShareLinkStatus } from "@/lib/messaging/share";

export type ShareTelemetryRow = {
  id: string;
  created_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
};

export type ShareFailureEntry = {
  reason: string;
  count: number;
};

export type ShareTelemetrySummary = {
  sampleSize: number;
  statusCounts: Record<ShareLinkStatus, number>;
  topFailureReasons: ShareFailureEntry[];
};

export function buildShareTelemetrySummary(
  rows: ShareTelemetryRow[],
  now = new Date()
): ShareTelemetrySummary {
  const statusCounts: Record<ShareLinkStatus, number> = {
    active: 0,
    expired: 0,
    revoked: 0,
    invalid: 0,
  };

  rows.forEach((row) => {
    const status = resolveShareStatus(
      row.expires_at
        ? { expiresAt: row.expires_at, revokedAt: row.revoked_at ?? null }
        : null,
      now
    );
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  });

  const topFailureReasons: ShareFailureEntry[] = [
    { reason: "invalid", count: statusCounts.invalid },
    { reason: "expired", count: statusCounts.expired },
    { reason: "revoked", count: statusCounts.revoked },
  ];

  return {
    sampleSize: rows.length,
    statusCounts,
    topFailureReasons,
  };
}
