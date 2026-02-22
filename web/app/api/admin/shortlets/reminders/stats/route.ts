import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/shortlets/reminders/stats";

type ReminderStatsDbClient = UntypedAdminClient;

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUtc(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function nextQuarterHourIso(now: Date) {
  const next = new Date(now.getTime());
  next.setUTCSeconds(0, 0);
  const minutes = next.getUTCMinutes();
  const remainder = minutes % 15;
  const add = remainder === 0 ? 15 : 15 - remainder;
  next.setUTCMinutes(minutes + add);
  return next.toISOString();
}

async function countSentInRange(input: {
  client: ReminderStatsDbClient;
  startIso: string;
  endIso: string;
}) {
  const result = (await input.client
    .from("shortlet_reminder_events")
    .select("id")
    .gte("sent_at", input.startIso)
    .lt("sent_at", input.endIso)) as unknown as {
    data?: Array<{ id: string }> | null;
    error?: { message?: string | null } | null;
  };

  if (result.error) {
    throw new Error(result.error.message || "Unable to load reminder stats");
  }
  return Array.isArray(result.data) ? result.data.length : 0;
}

export type AdminShortletReminderStatsDeps = {
  requireRole: typeof requireRole;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  now: () => Date;
  countSentInRange: typeof countSentInRange;
};

const defaultDeps: AdminShortletReminderStatsDeps = {
  requireRole,
  hasServiceRoleEnv,
  createServiceRoleClient,
  now: () => new Date(),
  countSentInRange,
};

export const dynamic = "force-dynamic";

export async function getAdminShortletReminderStatsResponse(
  request: NextRequest,
  deps: AdminShortletReminderStatsDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const client = deps.hasServiceRoleEnv()
    ? (deps.createServiceRoleClient() as unknown as ReminderStatsDbClient)
    : (auth.supabase as unknown as ReminderStatsDbClient);

  const now = deps.now();
  const start = startOfUtcDay(now);
  const end = addDaysUtc(start, 1);
  const sentToday = await deps.countSentInRange({
    client,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  });

  return NextResponse.json({
    ok: true,
    route: routeLabel,
    asOf: toDateKey(start),
    sentToday,
    failedToday: 0,
    nextRunAt: nextQuarterHourIso(now),
    failureSource: "cron_logs_and_artifacts",
  });
}

export async function GET(request: NextRequest) {
  return getAdminShortletReminderStatsResponse(request, defaultDeps);
}
