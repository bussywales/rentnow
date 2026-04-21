import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import {
  getCriticalSchemaReadiness,
  type SchemaClient,
} from "@/lib/ops/critical-schema-readiness";

type DeepHealthDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  getCriticalSchemaReadiness: (client: SchemaClient) => ReturnType<typeof getCriticalSchemaReadiness>;
  logFailure: typeof logFailure;
  now: () => number;
};

const defaultDeps: DeepHealthDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  getCriticalSchemaReadiness,
  logFailure,
  now: () => Date.now(),
};

function resolveCommitSha() {
  return (
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    null
  );
}

type DeepHealthReasonCode =
  | "SUPABASE_ENV_MISSING"
  | "SUPABASE_QUERY_FAILED"
  | "SCHEMA_COLUMNS_MISSING"
  | "SCHEMA_READINESS_QUERY_FAILED";

export async function getDeepHealthResponse(
  request: Request,
  deps: DeepHealthDeps = defaultDeps
) {
  const startTime = deps.now();
  const routeLabel = "/api/health/deep";
  const commit = resolveCommitSha();

  if (!deps.hasServerSupabaseEnv()) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      {
        ok: false,
        latencyMs: 0,
        supabaseReachable: false,
        schemaReady: false,
        reasonCode: "SUPABASE_ENV_MISSING" satisfies DeepHealthReasonCode,
        errorReason: "Supabase env vars missing",
        commit,
      },
      { status: 503 }
    );
  }

  try {
    const supabase = await deps.createServerSupabaseClient();
    const queryStart = deps.now();
    const { error } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .limit(1);
    const latencyMs = Math.max(0, deps.now() - queryStart);

    if (error) {
      deps.logFailure({
        request,
        route: routeLabel,
        status: 503,
        startTime,
        error,
      });
      return NextResponse.json(
        {
          ok: false,
          latencyMs,
          supabaseReachable: false,
          schemaReady: false,
          reasonCode: "SUPABASE_QUERY_FAILED" satisfies DeepHealthReasonCode,
          errorReason: "Supabase query failed",
          commit,
        },
        { status: 503 }
      );
    }

    const schema = await deps.getCriticalSchemaReadiness(supabase as unknown as SchemaClient);

    if (!schema.ready) {
      deps.logFailure({
        request,
        route: routeLabel,
        status: 503,
        startTime,
        error: schema.queryError
          ? new Error(schema.queryError)
          : `Missing schema columns: ${schema.missing
              .map((item) => `${item.table}.${item.column}`)
              .join(", ")}`,
      });
      return NextResponse.json(
        {
          ok: false,
          latencyMs,
          supabaseReachable: true,
          schemaReady: false,
          reasonCode: (schema.queryError
            ? "SCHEMA_READINESS_QUERY_FAILED"
            : "SCHEMA_COLUMNS_MISSING") satisfies DeepHealthReasonCode,
          errorReason: schema.queryError
            ? "Schema readiness check failed"
            : "Critical schema columns are missing",
          missingColumns: schema.missing.map((item) => `${item.table}.${item.column}`),
          checkedCount: schema.checkedCount,
          checkedAt: schema.checkedAt,
          commit,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      latencyMs,
      supabaseReachable: true,
      schemaReady: true,
      reasonCode: null,
      checkedCount: schema.checkedCount,
      checkedAt: schema.checkedAt,
      commit,
    });
  } catch (err) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json(
      {
        ok: false,
        latencyMs: 0,
        supabaseReachable: false,
        schemaReady: false,
        reasonCode: "SUPABASE_QUERY_FAILED" satisfies DeepHealthReasonCode,
        errorReason: "Supabase query failed",
        commit,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return getDeepHealthResponse(request, defaultDeps);
}
