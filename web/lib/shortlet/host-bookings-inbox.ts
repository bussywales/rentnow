import {
  normalizeShortletBookingStatus,
  type ShortletBookingStatus,
} from "@/lib/shortlet/return-status";

export type HostBookingInboxFilter =
  | "awaiting_approval"
  | "upcoming"
  | "past"
  | "closed";

export function parseHostBookingInboxFilterParam(
  value: string | null | undefined
): HostBookingInboxFilter | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "awaiting" || normalized === "awaiting_approval" || normalized === "pending") {
    return "awaiting_approval";
  }
  if (normalized === "upcoming") return "upcoming";
  if (normalized === "past") return "past";
  if (normalized === "closed" || normalized === "cancelled") return "closed";
  return null;
}

export type HostBookingInboxRow = {
  id: string;
  status: string;
  check_in?: string | null;
  check_out?: string | null;
  respond_by?: string | null;
  expires_at?: string | null;
};

export const HOST_INBOX_HIDDEN_STATUSES = ["pending_payment"] as const;

function parseDateMs(value: string | null | undefined): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseIsoDateOnly(value: string | null | undefined): Date | null {
  const raw = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function startOfTodayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function resolveStatus(status: string | null | undefined): ShortletBookingStatus | null {
  return normalizeShortletBookingStatus(status);
}

export function isAwaitingApprovalBooking(
  row: Pick<HostBookingInboxRow, "status" | "respond_by" | "expires_at">,
  nowInput?: Date
) {
  const status = resolveStatus(row.status);
  if (status !== "pending") return false;

  const nowMs = (nowInput ?? new Date()).getTime();
  const respondByMs = parseDateMs(row.respond_by);
  const expiresAtMs = parseDateMs(row.expires_at);
  const deadlineMs = respondByMs ?? expiresAtMs;
  if (deadlineMs !== null && deadlineMs <= nowMs) return false;
  return true;
}

export function parseHostBookingQueryParam(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (!UUID_PATTERN.test(normalized)) return null;
  return normalized.toLowerCase();
}

export function resolveHostBookingInboxFilter(
  row: HostBookingInboxRow,
  nowInput?: Date
): HostBookingInboxFilter {
  const now = nowInput ?? new Date();
  const status = resolveStatus(row.status);
  if (!status) return "closed";

  if (status === "pending") {
    if (!isAwaitingApprovalBooking(row, now)) return "closed";
    return "awaiting_approval";
  }
  if (status === "pending_payment") {
    return "closed";
  }
  if (status === "declined" || status === "cancelled" || status === "expired") {
    return "closed";
  }
  if (status === "completed") {
    return "past";
  }
  if (status === "confirmed") {
    const checkout = parseIsoDateOnly(row.check_out);
    if (!checkout) return "upcoming";
    return checkout < startOfTodayUtc(now) ? "past" : "upcoming";
  }

  return "closed";
}

export function rowMatchesHostBookingInboxFilter(
  row: HostBookingInboxRow,
  filter: HostBookingInboxFilter,
  nowInput?: Date
) {
  return resolveHostBookingInboxFilter(row, nowInput) === filter;
}

export function countAwaitingApprovalBookings(rows: HostBookingInboxRow[], nowInput?: Date) {
  const now = nowInput ?? new Date();
  return rows.filter((row) => isAwaitingApprovalBooking(row, now)).length;
}

export function shouldDefaultHostToBookingsInbox(input: {
  awaitingApprovalCount: number;
  tab?: string | null;
  section?: string | null;
  bookingId?: string | null;
}) {
  if (input.awaitingApprovalCount <= 0) return false;
  if (parseHostBookingQueryParam(input.bookingId || null)) return true;
  const tab = String(input.tab || "").trim().toLowerCase();
  const section = String(input.section || "").trim().toLowerCase();
  const hasSection = tab === "bookings" || tab === "listings" || section === "bookings" || section === "listings";
  return !hasSection;
}

export function resolveRespondByIso(row: HostBookingInboxRow): string | null {
  const respondBy = String(row.respond_by || "").trim();
  if (respondBy) return respondBy;
  const expiresAt = String(row.expires_at || "").trim();
  if (expiresAt) return expiresAt;
  return null;
}

export function formatRespondByCountdownLabel(
  respondByIso: string | null | undefined,
  nowMsInput?: number
) {
  const nowMs = Number.isFinite(nowMsInput) ? Number(nowMsInput) : Date.now();
  const targetMs = respondByIso ? Date.parse(respondByIso) : NaN;
  if (!Number.isFinite(targetMs)) return "Host response window: 12 hours.";

  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) return "12-hour response window elapsed.";

  const totalMinutes = Math.max(1, Math.floor(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m left in the 12-hour response window.`;
  }
  if (minutes <= 0) {
    return `${hours}h left in the 12-hour response window.`;
  }
  return `${hours}h ${minutes}m left in the 12-hour response window.`;
}
