type Window = { start: number; end: number };

export type AvailabilityRule = {
  day_of_week: number;
  start_minute: number;
  end_minute: number;
};

export type AvailabilityException = {
  local_date: string;
  exception_type: "blackout" | "add_window";
  start_minute?: number | null;
  end_minute?: number | null;
};

const DEFAULT_TIMEZONE = "Africa/Lagos";
const DAILY_START = 6 * 60;
const DAILY_END = 22 * 60;

export function validateTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new Error("Invalid timezone");
  }
}

function getOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour),
    Number(lookup.minute),
    Number(lookup.second)
  );
  return (asUtc - date.getTime()) / 60000;
}

function zonedTimeToUTCISO(dateStr: string, minuteOfDay: number, timeZone: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utcGuess = Date.UTC(year, (month ?? 1) - 1, day ?? 1, 0, minuteOfDay);
  const offsetMinutes = getOffsetMinutes(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offsetMinutes * 60000).toISOString();
}

export function isoToLocalDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function mergeWindows(windows: Window[]): Window[] {
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const merged: Window[] = [];
  for (const w of sorted) {
    if (merged.length === 0 || w.start > merged[merged.length - 1].end) {
      merged.push({ ...w });
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, w.end);
    }
  }
  return merged;
}

function subtractInterval(windows: Window[], start: number, end: number): Window[] {
  const result: Window[] = [];
  for (const w of windows) {
    // no overlap
    if (end <= w.start || start >= w.end) {
      result.push(w);
      continue;
    }
    // interval fully covers window -> drop
    if (start <= w.start && end >= w.end) {
      continue;
    }
    // trim left
    if (start <= w.start && end < w.end) {
      result.push({ start: end, end: w.end });
      continue;
    }
    // trim right
    if (start > w.start && end >= w.end) {
      result.push({ start: w.start, end: start });
      continue;
    }
    // split
    result.push({ start: w.start, end: start });
    result.push({ start: end, end: w.end });
  }
  return mergeWindows(result);
}

function addInterval(windows: Window[], start: number, end: number): Window[] {
  return mergeWindows([...windows, { start, end }]);
}

function ensureWithinDailyBounds(window: Window) {
  if (window.start < DAILY_START || window.end > DAILY_END || window.start >= window.end) {
    throw new Error("Availability windows must be within 06:00 and 22:00 local time");
  }
}

function normalizeRuleWindows(rules: AvailabilityRule[]): Window[] {
  return rules.map((r) => {
    if (r.start_minute < 0 || r.end_minute > 1440 || r.start_minute >= r.end_minute) {
      throw new Error("Invalid availability window");
    }
    const win = { start: r.start_minute, end: r.end_minute };
    ensureWithinDailyBounds(win);
    return win;
  });
}

function applyExceptions(windows: Window[], exceptions: AvailabilityException[]): Window[] {
  let result = [...windows];
  for (const ex of exceptions) {
    const start = ex.start_minute ?? null;
    const end = ex.end_minute ?? null;
    if (ex.exception_type === "blackout") {
      if (start === null || end === null) {
        result = [];
      } else {
        ensureWithinDailyBounds({ start, end });
        result = subtractInterval(result, start, end);
      }
    } else if (ex.exception_type === "add_window") {
      if (start === null || end === null) continue;
      ensureWithinDailyBounds({ start, end });
      result = addInterval(result, start, end);
    }
  }
  return mergeWindows(result);
}

export function generateSlotsForDate(options: {
  date: string; // YYYY-MM-DD in property local time
  timeZone?: string | null;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  slotMinutes?: number;
}) {
  const { date, rules, exceptions, slotMinutes = 30 } = options;
  const timeZone = options.timeZone || DEFAULT_TIMEZONE;
  validateTimeZone(timeZone);

  const day = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) {
    throw new Error("Invalid date");
  }

  const dayOfWeek = day.getUTCDay(); // safe since date string aligns across TZ
  const dayRules = rules.filter((r) => r.day_of_week === dayOfWeek);
  const windows =
    dayRules.length > 0 ? normalizeRuleWindows(dayRules) : [{ start: DAILY_START, end: DAILY_END }];

  const dayExceptions = exceptions.filter((ex) => ex.local_date === date);
  const finalWindows = applyExceptions(windows, dayExceptions);
  const slots: { utc: string; local: string }[] = [];

  for (const w of finalWindows) {
    for (let minutes = w.start; minutes < w.end; minutes += slotMinutes) {
      const iso = zonedTimeToUTCISO(date, minutes, timeZone);
      slots.push({
        utc: iso,
        local: new Intl.DateTimeFormat("en-GB", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(iso)),
      });
    }
  }

  return { slots, windows: finalWindows, timeZone };
}

export function assertPreferredTimesInAvailability(options: {
  preferredTimes: string[];
  timeZone?: string | null;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
}) {
  const { preferredTimes, timeZone, rules, exceptions } = options;
  const tz = timeZone || DEFAULT_TIMEZONE;
  validateTimeZone(tz);

  if (preferredTimes.length < 1 || preferredTimes.length > 3) {
    throw new Error("Preferred times must include 1 to 3 entries");
  }

  const normalized = preferredTimes.map((t) => {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) throw new Error("Invalid preferred time");
    return d.toISOString();
  });

  const dates = Array.from(new Set(normalized.map((iso) => isoToLocalDate(iso, tz))));
  const slotMap = new Map<string, Set<string>>();

  for (const date of dates) {
    const { slots } = generateSlotsForDate({
      date,
      timeZone: tz,
      rules,
      exceptions,
    });
    slotMap.set(
      date,
      new Set(
        slots.map((s) => s.utc)
      )
    );
  }

  for (const iso of normalized) {
    const date = isoToLocalDate(iso, tz);
    const allowed = slotMap.get(date);
    if (!allowed || !allowed.has(iso)) {
      throw new Error("One or more preferred times are not available for this property");
    }
  }

  return normalized;
}
