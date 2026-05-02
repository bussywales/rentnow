import { z } from "zod";
import {
  DELIVERY_MONITOR_SEED_ITEMS,
  DELIVERY_MONITOR_ITEM_KEYS,
  getDeliveryMonitorSeedItem,
  type DeliveryMonitorSeedItem,
  type DeliveryMonitorStatus,
  type DeliveryMonitorTestingStatus,
} from "@/lib/admin/delivery-monitor-seed";

export type {
  DeliveryMonitorSeedItem,
  DeliveryMonitorStatus,
  DeliveryMonitorTestingStatus,
} from "@/lib/admin/delivery-monitor-seed";

export type DeliveryMonitorStateOverrideRow = {
  item_key: string;
  status: DeliveryMonitorStatus;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryMonitorTestRunRow = {
  id: string;
  item_key: string;
  testing_status: DeliveryMonitorTestingStatus;
  tester_name: string;
  notes: string | null;
  tested_at: string;
  created_by: string | null;
  created_at: string;
};

export type DeliveryMonitorNoteRow = {
  id: string;
  item_key: string;
  body: string;
  author_name: string;
  created_by: string | null;
  created_at: string;
};

export type DeliveryMonitorMergedItem = DeliveryMonitorSeedItem & {
  effectiveStatus: DeliveryMonitorStatus;
  statusOverride: DeliveryMonitorStateOverrideRow | null;
  latestTestRun: DeliveryMonitorTestRunRow | null;
  latestNote: DeliveryMonitorNoteRow | null;
  testingStatus: DeliveryMonitorTestingStatus;
  testRuns: DeliveryMonitorTestRunRow[];
  notesLog: DeliveryMonitorNoteRow[];
  lastUpdatedAt: string;
};

export const deliveryMonitorStatusSchema = z.enum(["green", "amber", "red"]);
export const deliveryMonitorTestingStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "passed",
  "failed",
]);

export const deliveryMonitorStatusUpdateSchema = z.object({
  status: deliveryMonitorStatusSchema,
});

export const deliveryMonitorTestRunCreateSchema = z.object({
  testingStatus: deliveryMonitorTestingStatusSchema,
  testerName: z.string().trim().min(1, "Tester name is required.").max(120),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const deliveryMonitorNoteCreateSchema = z.object({
  body: z.string().trim().min(1, "Note is required.").max(2000),
});

export function isDeliveryMonitorItemKey(value: string) {
  return DELIVERY_MONITOR_ITEM_KEYS.has(value);
}

export function getDeliveryMonitorStatusLabel(status: DeliveryMonitorStatus) {
  if (status === "green") return "Green";
  if (status === "amber") return "Amber";
  return "Red";
}

export function getDeliveryMonitorTestingStatusLabel(status: DeliveryMonitorTestingStatus) {
  switch (status) {
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    case "in_progress":
      return "In progress";
    default:
      return "Not started";
  }
}

export function getDeliveryMonitorStatusTone(status: DeliveryMonitorStatus) {
  if (status === "green") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "amber") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

export function getDeliveryMonitorTestingTone(status: DeliveryMonitorTestingStatus) {
  switch (status) {
    case "passed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "in_progress":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function maxIsoDate(...values: Array<string | null | undefined>) {
  const timestamps = values
    .map((value) => {
      if (!value) return null;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((value): value is number => value !== null);

  if (!timestamps.length) return new Date(0).toISOString();
  return new Date(Math.max(...timestamps)).toISOString();
}

export function mergeDeliveryMonitorItems(input: {
  statusOverrides?: DeliveryMonitorStateOverrideRow[] | null;
  testRuns?: DeliveryMonitorTestRunRow[] | null;
  notes?: DeliveryMonitorNoteRow[] | null;
}) {
  const overrideMap = new Map((input.statusOverrides ?? []).map((row) => [row.item_key, row]));
  const testRunMap = new Map<string, DeliveryMonitorTestRunRow[]>();
  const noteMap = new Map<string, DeliveryMonitorNoteRow[]>();

  for (const row of input.testRuns ?? []) {
    const existing = testRunMap.get(row.item_key) ?? [];
    existing.push(row);
    existing.sort((a, b) => Date.parse(b.tested_at) - Date.parse(a.tested_at));
    testRunMap.set(row.item_key, existing);
  }

  for (const row of input.notes ?? []) {
    const existing = noteMap.get(row.item_key) ?? [];
    existing.push(row);
    existing.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    noteMap.set(row.item_key, existing);
  }

  return DELIVERY_MONITOR_SEED_ITEMS.map((seed) => {
    const statusOverride = overrideMap.get(seed.key) ?? null;
    const testRuns = testRunMap.get(seed.key) ?? [];
    const notesLog = noteMap.get(seed.key) ?? [];
    const latestTestRun = testRuns[0] ?? null;
    const latestNote = notesLog[0] ?? null;
    const effectiveStatus = statusOverride?.status ?? seed.status;
    const testingStatus = latestTestRun?.testing_status ?? "not_started";
    const lastUpdatedAt = maxIsoDate(
      seed.repoUpdatedAt,
      statusOverride?.updated_at,
      latestTestRun?.tested_at,
      latestNote?.created_at
    );

    return {
      ...seed,
      effectiveStatus,
      statusOverride,
      latestTestRun,
      latestNote,
      testingStatus,
      testRuns,
      notesLog,
      lastUpdatedAt,
    } satisfies DeliveryMonitorMergedItem;
  }).sort((a, b) => {
    const severity = { red: 0, amber: 1, green: 2 } as const;
    const statusCompare = severity[a.effectiveStatus] - severity[b.effectiveStatus];
    if (statusCompare !== 0) return statusCompare;
    return Date.parse(b.lastUpdatedAt) - Date.parse(a.lastUpdatedAt);
  });
}

export function summarizeDeliveryMonitorCounts(items: DeliveryMonitorMergedItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.effectiveStatus] += 1;
      acc[item.testingStatus] += 1;
      return acc;
    },
    {
      total: 0,
      green: 0,
      amber: 0,
      red: 0,
      not_started: 0,
      in_progress: 0,
      passed: 0,
      failed: 0,
    }
  );
}

export function getDeliveryMonitorSeedCatalogue() {
  return DELIVERY_MONITOR_SEED_ITEMS;
}

export function resolveDeliveryMonitorItem(key: string) {
  return getDeliveryMonitorSeedItem(key);
}
