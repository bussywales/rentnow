import { NextResponse, type NextRequest } from "next/server";
import {
  dispatchPropertyRequestExpiryReminders,
  type PropertyRequestExpiryReminderDeps,
} from "@/lib/requests/property-request-retention.server";
import { hasServiceRoleEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const routeLabel = "/api/internal/requests/send-expiry-reminders";

export type PropertyRequestExpiryRemindersRouteDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  getCronSecret: () => string;
  now: () => Date;
  dispatchReminders: (deps?: PropertyRequestExpiryReminderDeps) => ReturnType<typeof dispatchPropertyRequestExpiryReminders>;
};

const defaultDeps: PropertyRequestExpiryRemindersRouteDeps = {
  hasServiceRoleEnv,
  getCronSecret: () => process.env.CRON_SECRET || "",
  now: () => new Date(),
  dispatchReminders: dispatchPropertyRequestExpiryReminders,
};

function hasValidCronSecret(request: NextRequest, expected: string) {
  if (!expected) return false;
  return request.headers.get("x-cron-secret") === expected;
}

export async function postPropertyRequestExpiryRemindersResponse(
  request: NextRequest,
  deps: PropertyRequestExpiryRemindersRouteDeps = defaultDeps
) {
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const expectedSecret = deps.getCronSecret();
  if (!hasValidCronSecret(request, expectedSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await deps.dispatchReminders();
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.errors[0] || "Unable to dispatch property request reminders",
        route: routeLabel,
        asOf: deps.now().toISOString(),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    route: routeLabel,
    scanned: result.scanned,
    due: result.due,
    sent: result.sent,
    skipped: result.skipped,
    errorsCount: result.errors.length,
    errors: result.errors,
    asOf: deps.now().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return postPropertyRequestExpiryRemindersResponse(request);
}
