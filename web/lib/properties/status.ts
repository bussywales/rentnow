export const PAUSED_STATUSES = ["paused", "paused_owner", "paused_occupied"] as const;

export type PausedStatus = (typeof PAUSED_STATUSES)[number];

export function normalizePropertyStatus(status?: string | null): string | null {
  if (!status) return null;
  return status.toString().trim().toLowerCase();
}

export function isPausedStatus(status?: string | null): status is PausedStatus {
  const normalized = normalizePropertyStatus(status);
  return !!normalized && (PAUSED_STATUSES as readonly string[]).includes(normalized);
}

export function mapStatusLabel(status?: string | null): string {
  const normalized = normalizePropertyStatus(status);
  if (!normalized) return "Unknown";
  switch (normalized) {
    case "live":
      return "Live";
    case "pending":
      return "Pending";
    case "draft":
      return "Draft";
    case "rejected":
      return "Rejected";
    case "expired":
      return "Expired";
    case "paused_owner":
      return "Paused - Owner hold";
    case "paused_occupied":
      return "Paused - Occupied";
    case "paused":
      return "Paused";
    case "changes_requested":
      return "Changes requested";
    default:
      return normalized;
  }
}
