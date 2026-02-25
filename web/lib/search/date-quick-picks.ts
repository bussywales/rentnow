export type MobileQuickSearchDateQuickPick = "this_weekend" | "next_weekend" | "flexible";

export type MobileQuickSearchDateRange = {
  checkIn: string;
  checkOut: string;
};

function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function resolveNextFriday(baseDate: Date): Date {
  const day = baseDate.getDay();
  const delta = (5 - day + 7) % 7;
  return addDays(baseDate, delta);
}

export function getWeekendRange(baseDate: Date, offsetWeeks = 0): MobileQuickSearchDateRange {
  const safeOffset = Number.isFinite(offsetWeeks) ? Math.max(0, Math.trunc(offsetWeeks)) : 0;
  const anchor = startOfDay(baseDate);
  const friday = resolveNextFriday(anchor);
  const checkInDate = addDays(friday, safeOffset * 7);
  const checkOutDate = addDays(checkInDate, 2);
  return {
    checkIn: toDateKey(checkInDate),
    checkOut: toDateKey(checkOutDate),
  };
}

export function resolveDateQuickPickRange(
  pick: MobileQuickSearchDateQuickPick,
  baseDate: Date
): MobileQuickSearchDateRange | null {
  if (pick === "this_weekend") return getWeekendRange(baseDate, 0);
  if (pick === "next_weekend") return getWeekendRange(baseDate, 1);
  return null;
}

export function isDateKey(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
