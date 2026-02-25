import { NextResponse, type NextRequest } from "next/server";
import { fetchDailyFxSnapshot } from "@/lib/fx/fx-provider.server";
import { upsertFxSnapshot } from "@/lib/fx/fx-cache.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";

const routeLabel = "/api/internal/fx/fetch-daily";

type FxFetchDailySummary = {
  ok: true;
  route: string;
  date: string;
  baseCurrency: string;
  currenciesCount: number;
  source: string;
  fetchedAt: string | null | undefined;
};

export type InternalFxFetchDailyDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getCronSecret: () => string;
  now: () => Date;
  fetchDailyFxSnapshot: typeof fetchDailyFxSnapshot;
  upsertFxSnapshot: typeof upsertFxSnapshot;
};

const defaultDeps: InternalFxFetchDailyDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  getCronSecret: () => process.env.CRON_SECRET || "",
  now: () => new Date(),
  fetchDailyFxSnapshot,
  upsertFxSnapshot,
};

function hasValidCronSecret(request: NextRequest, expected: string) {
  if (!expected) return false;
  return request.headers.get("x-cron-secret") === expected;
}

export async function postInternalFxFetchDailyResponse(
  request: NextRequest,
  deps: InternalFxFetchDailyDeps = defaultDeps
) {
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }
  if (!hasValidCronSecret(request, deps.getCronSecret())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = deps.now();
  try {
    const snapshot = await deps.fetchDailyFxSnapshot({
      now,
    });
    await deps.upsertFxSnapshot({
      snapshot,
      client: deps.createServiceRoleClient() as unknown as UntypedAdminClient,
    });
    const payload: FxFetchDailySummary = {
      ok: true,
      route: routeLabel,
      date: snapshot.date,
      baseCurrency: snapshot.baseCurrency,
      currenciesCount: Object.keys(snapshot.rates).length,
      source: snapshot.source,
      fetchedAt: snapshot.fetchedAt,
    };
    console.info("[fx/fetch-daily] run", payload);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch daily FX rates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return postInternalFxFetchDailyResponse(request, defaultDeps);
}
