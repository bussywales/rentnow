import { resolveRespondByIso, type HostBookingInboxRow } from "@/lib/shortlet/host-bookings-inbox";

export type HostInboxSlaTier = "critical" | "warning" | "ok" | "expired";

function parseIsoMs(value: string | null | undefined): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getSlaTier(respondByIso: string | null | undefined, now = Date.now()): HostInboxSlaTier {
  const targetMs = parseIsoMs(respondByIso);
  if (targetMs === null) return "ok";
  const diffMs = targetMs - now;
  if (diffMs <= 0) return "expired";
  if (diffMs <= 60 * 60 * 1000) return "critical";
  if (diffMs <= 3 * 60 * 60 * 1000) return "warning";
  return "ok";
}

export function formatTimeRemaining(respondByIso: string | null | undefined, now = Date.now()): string {
  const targetMs = parseIsoMs(respondByIso);
  if (targetMs === null) return "Respond in 12h";

  const diffMs = targetMs - now;
  if (diffMs <= 0) return "Expired - will auto-expire";

  const totalMinutes = Math.max(1, Math.floor(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `Respond in ${minutes}m`;
  if (minutes <= 0) return `Respond in ${hours}h`;
  return `Respond in ${hours}h ${minutes}m`;
}

type AwaitingRow = Pick<HostBookingInboxRow, "id" | "respond_by" | "expires_at">;

function resolveDeadlineMs(row: AwaitingRow): number {
  const parsed = parseIsoMs(resolveRespondByIso(row));
  return parsed ?? Number.POSITIVE_INFINITY;
}

export function groupAwaitingBookings<T extends AwaitingRow>(rows: T[], now = Date.now()) {
  const urgent: T[] = [];
  const later: T[] = [];

  for (const row of rows) {
    const tier = getSlaTier(resolveRespondByIso(row), now);
    if (tier === "critical" || tier === "warning" || tier === "expired") {
      urgent.push(row);
      continue;
    }
    later.push(row);
  }

  urgent.sort((a, b) => resolveDeadlineMs(a) - resolveDeadlineMs(b));
  later.sort((a, b) => resolveDeadlineMs(a) - resolveDeadlineMs(b));

  return { urgent, later };
}

