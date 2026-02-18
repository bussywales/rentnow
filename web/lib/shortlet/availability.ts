export type ShortletUnavailableRange = {
  start: string;
  end: string;
  source?: string | null;
  bookingId?: string | null;
};

export type ShortletRangeValidationReason =
  | "missing_dates"
  | "invalid_date"
  | "checkout_before_checkin"
  | "min_nights"
  | "max_nights"
  | "includes_unavailable_night";

export type ShortletRangeValidationResult = {
  valid: boolean;
  reason: ShortletRangeValidationReason | null;
  nights: number | null;
};

export type ShortletAvailabilityConflictResult = {
  hasConflict: boolean;
  conflictingDates: string[];
  conflictingRanges: ShortletUnavailableRange[];
};

function parseDateKey(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
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

  return { year, month, day };
}

function dateKeyToUtcMs(value: string): number | null {
  const parsed = parseDateKey(value);
  if (!parsed) return null;
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day);
}

function utcMsToDateKey(value: number): string {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number): string {
  const utcMs = dateKeyToUtcMs(dateKey);
  if (utcMs == null) return dateKey;
  return utcMsToDateKey(utcMs + days * 24 * 60 * 60 * 1000);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  return addDays(dateKey, days);
}

function compareDateKeys(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(value: string): Date | null {
  const parsed = parseDateKey(value);
  if (!parsed) return null;
  return new Date(parsed.year, parsed.month - 1, parsed.day);
}

export function expandRangesToDisabledDates(
  ranges: ReadonlyArray<ShortletUnavailableRange>,
  from?: string | null,
  to?: string | null
): Set<string> {
  const disabled = new Set<string>();
  const boundedFrom = from ?? null;
  const boundedTo = to ?? null;

  for (const range of ranges) {
    if (!range?.start || !range?.end) continue;
    if (!parseDateKey(range.start) || !parseDateKey(range.end)) continue;
    if (compareDateKeys(range.start, range.end) >= 0) continue;

    let cursor = range.start;
    let stop = range.end;

    if (boundedFrom && compareDateKeys(cursor, boundedFrom) < 0) {
      cursor = boundedFrom;
    }
    if (boundedTo && compareDateKeys(stop, boundedTo) > 0) {
      stop = boundedTo;
    }
    if (compareDateKeys(cursor, stop) >= 0) continue;

    while (compareDateKeys(cursor, stop) < 0) {
      disabled.add(cursor);
      cursor = addDays(cursor, 1);
    }
  }

  return disabled;
}

function rangeOverlaps(input: {
  leftStart: string;
  leftEnd: string;
  rightStart: string;
  rightEnd: string;
}): boolean {
  return (
    compareDateKeys(input.leftStart, input.rightEnd) < 0 &&
    compareDateKeys(input.rightStart, input.leftEnd) < 0
  );
}

export function applyPrepBufferToUnavailableRanges(
  ranges: ReadonlyArray<ShortletUnavailableRange>,
  prepDays: number
): ShortletUnavailableRange[] {
  const normalizedPrepDays = Math.max(0, Math.trunc(prepDays || 0));
  if (normalizedPrepDays < 1) return [...ranges];

  return ranges.map((range) => {
    const shouldApply =
      range.source === "booking" || (typeof range.bookingId === "string" && range.bookingId.length > 0);
    if (!shouldApply) return { ...range };
    return {
      ...range,
      end: addDays(range.end, normalizedPrepDays),
    };
  });
}

export function resolveAvailabilityConflicts(input: {
  checkIn: string;
  checkOut: string;
  unavailableRanges: ReadonlyArray<ShortletUnavailableRange>;
  prepDays?: number | null;
}): ShortletAvailabilityConflictResult {
  if (!parseDateKey(input.checkIn) || !parseDateKey(input.checkOut)) {
    return {
      hasConflict: false,
      conflictingDates: [],
      conflictingRanges: [],
    };
  }
  if (compareDateKeys(input.checkIn, input.checkOut) >= 0) {
    return {
      hasConflict: false,
      conflictingDates: [],
      conflictingRanges: [],
    };
  }

  const effectiveRanges = applyPrepBufferToUnavailableRanges(
    input.unavailableRanges,
    input.prepDays ?? 0
  ).filter((range) => {
    if (!range?.start || !range?.end) return false;
    if (!parseDateKey(range.start) || !parseDateKey(range.end)) return false;
    if (compareDateKeys(range.start, range.end) >= 0) return false;
    return rangeOverlaps({
      leftStart: range.start,
      leftEnd: range.end,
      rightStart: input.checkIn,
      rightEnd: input.checkOut,
    });
  });

  if (!effectiveRanges.length) {
    return {
      hasConflict: false,
      conflictingDates: [],
      conflictingRanges: [],
    };
  }

  const conflictingDateSet = new Set<string>();
  let cursor = input.checkIn;
  while (compareDateKeys(cursor, input.checkOut) < 0) {
    const blocked = effectiveRanges.some(
      (range) =>
        compareDateKeys(range.start, cursor) <= 0 &&
        compareDateKeys(cursor, range.end) < 0
    );
    if (blocked) {
      conflictingDateSet.add(cursor);
    }
    cursor = addDays(cursor, 1);
  }

  return {
    hasConflict: conflictingDateSet.size > 0,
    conflictingDates: Array.from(conflictingDateSet).sort(),
    conflictingRanges: effectiveRanges,
  };
}

export function validateRangeSelection(input: {
  checkIn: string | null | undefined;
  checkOut: string | null | undefined;
  disabledSet: ReadonlySet<string>;
  minNights?: number | null;
  maxNights?: number | null;
}): ShortletRangeValidationResult {
  const checkIn = input.checkIn ?? null;
  const checkOut = input.checkOut ?? null;

  if (!checkIn || !checkOut) {
    return {
      valid: false,
      reason: "missing_dates",
      nights: null,
    };
  }

  const checkInMs = dateKeyToUtcMs(checkIn);
  const checkOutMs = dateKeyToUtcMs(checkOut);
  if (checkInMs == null || checkOutMs == null) {
    return {
      valid: false,
      reason: "invalid_date",
      nights: null,
    };
  }

  const diffDays = (checkOutMs - checkInMs) / (24 * 60 * 60 * 1000);
  if (!Number.isFinite(diffDays) || diffDays < 1 || !Number.isInteger(diffDays)) {
    return {
      valid: false,
      reason: "checkout_before_checkin",
      nights: null,
    };
  }

  const minNights = typeof input.minNights === "number" ? Math.max(1, Math.trunc(input.minNights)) : 1;
  if (diffDays < minNights) {
    return {
      valid: false,
      reason: "min_nights",
      nights: diffDays,
    };
  }

  const maxNights =
    typeof input.maxNights === "number" && Number.isFinite(input.maxNights)
      ? Math.max(minNights, Math.trunc(input.maxNights))
      : null;

  if (maxNights != null && diffDays > maxNights) {
    return {
      valid: false,
      reason: "max_nights",
      nights: diffDays,
    };
  }

  // Nights are modelled as [checkIn, checkOut). Checkout date itself is not stayed.
  let cursor = checkIn;
  while (compareDateKeys(cursor, checkOut) < 0) {
    if (input.disabledSet.has(cursor)) {
      return {
        valid: false,
        reason: "includes_unavailable_night",
        nights: diffDays,
      };
    }
    cursor = addDays(cursor, 1);
  }

  return {
    valid: true,
    reason: null,
    nights: diffDays,
  };
}

export function isRangeValid(input: {
  checkIn: string | null | undefined;
  checkOut: string | null | undefined;
  disabledSet: ReadonlySet<string>;
  minNights?: number | null;
  maxNights?: number | null;
}): boolean {
  return validateRangeSelection(input).valid;
}

export function nextValidEndDate(input: {
  checkIn: string;
  disabledSet: ReadonlySet<string>;
  minNights?: number | null;
  maxNights?: number | null;
  searchLimitDays?: number;
}): string | null {
  const startMs = dateKeyToUtcMs(input.checkIn);
  if (startMs == null) return null;

  const minNights = typeof input.minNights === "number" ? Math.max(1, Math.trunc(input.minNights)) : 1;
  const maxNights =
    typeof input.maxNights === "number" && Number.isFinite(input.maxNights)
      ? Math.max(minNights, Math.trunc(input.maxNights))
      : null;
  const maxSearch = Math.max(1, Math.trunc(input.searchLimitDays ?? 365));

  for (let dayOffset = minNights; dayOffset <= maxSearch; dayOffset += 1) {
    if (maxNights != null && dayOffset > maxNights) return null;
    const candidate = utcMsToDateKey(startMs + dayOffset * 24 * 60 * 60 * 1000);
    if (
      isRangeValid({
        checkIn: input.checkIn,
        checkOut: candidate,
        disabledSet: input.disabledSet,
        minNights,
        maxNights,
      })
    ) {
      return candidate;
    }
  }

  return null;
}
