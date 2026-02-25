import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";

const routeLabel = "/api/internal/support/autoclose";

type SupportAutoCloseSummary = {
  ok: true;
  route: string;
  asOf: string;
  resolvedDays: number;
  newDays: number;
  closedResolved: number;
  closedNew: number;
  totalClosed: number;
};

export type SupportAutoCloseDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getCronSecret: () => string;
  now: () => Date;
  getResolvedDays: () => number;
  getNewDays: () => number;
  closeResolved: (input: { client: UntypedAdminClient; beforeIso: string }) => Promise<number>;
  closeNew: (input: { client: UntypedAdminClient; beforeIso: string }) => Promise<number>;
};

function hasValidCronSecret(request: NextRequest, expected: string) {
  if (!expected) return false;
  return request.headers.get("x-cron-secret") === expected;
}

function parseDays(raw: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  return Math.min(parsed, 365);
}

function subtractDays(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function isMissingColumnError(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "42703") return true;
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return message.toLowerCase().includes(column.toLowerCase());
}

const defaultDeps: SupportAutoCloseDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  getCronSecret: () => process.env.CRON_SECRET || "",
  now: () => new Date(),
  getResolvedDays: () => parseDays(process.env.SUPPORT_AUTOCLOSE_RESOLVED_DAYS, 7),
  getNewDays: () => parseDays(process.env.SUPPORT_AUTOCLOSE_NEW_DAYS, 30),
  async closeResolved({ client, beforeIso }) {
    const attempt = await client
      .from("support_requests")
      .update({ status: "closed" })
      .eq("status", "resolved")
      .lte("resolved_at", beforeIso)
      .select("id");
    if (!attempt.error) return Array.isArray(attempt.data) ? attempt.data.length : 0;
    if (!isMissingColumnError(attempt.error, "resolved_at")) {
      throw new Error(String(attempt.error.message || "Unable to close resolved support requests."));
    }

    // Fallback for environments missing `resolved_at`.
    const fallback = await client
      .from("support_requests")
      .update({ status: "closed" })
      .eq("status", "resolved")
      .lte("created_at", beforeIso)
      .select("id");
    if (fallback.error) {
      throw new Error(String(fallback.error.message || "Unable to close resolved support requests."));
    }
    return Array.isArray(fallback.data) ? fallback.data.length : 0;
  },
  async closeNew({ client, beforeIso }) {
    const result = await client
      .from("support_requests")
      .update({ status: "closed" })
      .eq("status", "new")
      .lte("created_at", beforeIso)
      .select("id");
    if (result.error) {
      throw new Error(String(result.error.message || "Unable to close stale new support requests."));
    }
    return Array.isArray(result.data) ? result.data.length : 0;
  },
};

function resolvePolicy(request: NextRequest, deps: SupportAutoCloseDeps) {
  const resolvedFromQuery = request.nextUrl.searchParams.get("resolved_days");
  const newFromQuery = request.nextUrl.searchParams.get("new_days");
  return {
    resolvedDays: parseDays(resolvedFromQuery, deps.getResolvedDays()),
    newDays: parseDays(newFromQuery, deps.getNewDays()),
  };
}

export async function postInternalSupportAutocloseResponse(
  request: NextRequest,
  deps: SupportAutoCloseDeps = defaultDeps
) {
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const expectedSecret = deps.getCronSecret();
  if (!hasValidCronSecret(request, expectedSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = deps.now();
  const policy = resolvePolicy(request, deps);
  const client = deps.createServiceRoleClient() as unknown as UntypedAdminClient;

  try {
    let closedResolved = 0;
    let closedNew = 0;

    if (policy.resolvedDays > 0) {
      const resolvedCutoff = subtractDays(now, policy.resolvedDays).toISOString();
      closedResolved = await deps.closeResolved({
        client,
        beforeIso: resolvedCutoff,
      });
    }

    if (policy.newDays > 0) {
      const newCutoff = subtractDays(now, policy.newDays).toISOString();
      closedNew = await deps.closeNew({
        client,
        beforeIso: newCutoff,
      });
    }

    const payload: SupportAutoCloseSummary = {
      ok: true,
      route: routeLabel,
      asOf: now.toISOString(),
      resolvedDays: policy.resolvedDays,
      newDays: policy.newDays,
      closedResolved,
      closedNew,
      totalClosed: closedResolved + closedNew,
    };
    console.info("[support/autoclose] run", payload);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to auto-close support tickets.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return postInternalSupportAutocloseResponse(request, defaultDeps);
}
