import { z } from "zod";
import type { AvailabilityException, AvailabilityRule } from "@/lib/availability/slots";

export type WindowInput = { start: string; end: string };
export type DayRuleInput = { dayOfWeek: number; windows: WindowInput[] };

const DAILY_START = 6 * 60;
const DAILY_END = 22 * 60;

function timeToMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid time");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error("Invalid time");
  return hour * 60 + minute;
}

export function validateWindows(windows: WindowInput[]): { start: number; end: number }[] {
  if (!Array.isArray(windows)) return [];
  if (windows.length > 3) throw new Error("Maximum of 3 windows per day");
  const parsed = windows.map((w) => {
    const start = timeToMinutes(w.start);
    const end = timeToMinutes(w.end);
    if (start >= end) throw new Error("Start must be before end");
    if (start < DAILY_START || end > DAILY_END) {
      throw new Error("Windows must be between 06:00 and 22:00");
    }
    return { start, end };
  });
  const sorted = [...parsed].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      throw new Error("Windows cannot overlap");
    }
  }
  return sorted;
}

export function normalizeRuleInput(dayRules: DayRuleInput[]): AvailabilityRule[] {
  const rules: AvailabilityRule[] = [];
  for (const day of dayRules) {
    if (day.windows.length === 0) continue;
    const windows = validateWindows(day.windows);
    for (const win of windows) {
      rules.push({
        day_of_week: day.dayOfWeek,
        start_minute: win.start,
        end_minute: win.end,
      });
    }
  }
  return rules;
}

export function normalizeExceptionInput(input: {
  propertyId: string;
  date: string;
  type: "blackout" | "add_window";
  windows?: WindowInput[];
}): AvailabilityException[] {
  const schema = z.object({
    propertyId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type: z.enum(["blackout", "add_window"]),
    windows: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
  });
  const parsed = schema.parse(input);
  if (parsed.type === "blackout") {
    if (!parsed.windows || parsed.windows.length === 0) {
      return [
        {
          local_date: parsed.date,
          exception_type: "blackout",
          start_minute: null,
          end_minute: null,
        },
      ];
    }
    const wins = validateWindows(parsed.windows);
    return wins.map((w) => ({
      local_date: parsed.date,
      exception_type: "blackout",
      start_minute: w.start,
      end_minute: w.end,
    }));
  }
  const wins = validateWindows(parsed.windows || []);
  return wins.map((w) => ({
    local_date: parsed.date,
    exception_type: "add_window",
    start_minute: w.start,
    end_minute: w.end,
  }));
}

export function defaultTemplateRules(): DayRuleInput[] {
  return [
    { dayOfWeek: 1, windows: [{ start: "09:00", end: "17:00" }] },
    { dayOfWeek: 2, windows: [{ start: "09:00", end: "17:00" }] },
    { dayOfWeek: 3, windows: [{ start: "09:00", end: "17:00" }] },
    { dayOfWeek: 4, windows: [{ start: "09:00", end: "17:00" }] },
    { dayOfWeek: 5, windows: [{ start: "09:00", end: "17:00" }] },
    { dayOfWeek: 6, windows: [{ start: "10:00", end: "14:00" }] },
    { dayOfWeek: 0, windows: [] },
  ];
}
