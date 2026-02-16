import type { ShortletBookingRow } from "@/lib/shortlet/shortlet.server";

export type ShortletTripsFilter = "upcoming" | "pending" | "past" | "cancelled" | "all";

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDateKey(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const key = raw.slice(0, 10);
  if (!DATE_KEY_REGEX.test(key)) return null;
  return key;
}

function resolveTodayKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

export function resolveTripBucket(input: {
  status: ShortletBookingRow["status"] | string | null | undefined;
  checkIn: string | null | undefined;
  checkOut: string | null | undefined;
  now?: Date;
}): Exclude<ShortletTripsFilter, "all"> {
  const status = String(input.status || "").trim().toLowerCase();
  const todayKey = resolveTodayKey(input.now ?? new Date());
  const checkInKey = normalizeDateKey(input.checkIn);
  const checkOutKey = normalizeDateKey(input.checkOut);

  if (status === "pending" || status === "pending_payment") return "pending";
  if (status === "declined" || status === "cancelled" || status === "expired") {
    return "cancelled";
  }

  if (status === "confirmed" || status === "completed") {
    if (checkOutKey && checkOutKey < todayKey) return "past";
    if (checkInKey && checkInKey >= todayKey) return "upcoming";
    if (checkOutKey && checkOutKey >= todayKey) return "upcoming";
    return "past";
  }

  return "past";
}

export function matchesTripsFilter(input: {
  status: ShortletBookingRow["status"] | string | null | undefined;
  checkIn: string | null | undefined;
  checkOut: string | null | undefined;
  filter: ShortletTripsFilter;
  now?: Date;
}) {
  if (input.filter === "all") return true;
  return resolveTripBucket(input) === input.filter;
}
