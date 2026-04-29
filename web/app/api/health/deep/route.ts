import { NextResponse } from "next/server";
import { getUserRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import {
  getCriticalSchemaReadiness,
  type SchemaClient,
} from "@/lib/ops/critical-schema-readiness";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/health/deep";
const publicServiceName = "propatyhub-web";

type DeepHealthAccess = {
  isAdmin: boolean;
};

type DeepHealthDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  getCriticalSchemaReadiness: (client: SchemaClient) => ReturnType<typeof getCriticalSchemaReadiness>;
  logFailure: typeof logFailure;
  now: () => number;
  resolveDiagnosticAccess: (request: Request) => Promise<DeepHealthAccess>;
};

async function resolveDiagnosticAccess(): Promise<DeepHealthAccess> {
  if (!hasServerSupabaseEnv()) {
    return { isAdmin: false };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { isAdmin: false };
    }

    return {
      isAdmin: (await getUserRole(supabase, user.id)) === "admin",
    };
  } catch {
    return { isAdmin: false };
  }
}

const defaultDeps: DeepHealthDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  getCriticalSchemaReadiness,
  logFailure,
  now: () => Date.now(),
  resolveDiagnosticAccess,
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

function getReasonLabel(reasonCode: DeepHealthReasonCode | null) {
  switch (reasonCode) {
    case "SUPABASE_ENV_MISSING":
      return "Supabase server environment missing";
    case "SUPABASE_QUERY_FAILED":
      return "Supabase connectivity check failed";
    case "SCHEMA_COLUMNS_MISSING":
      return "Critical schema columns missing";
    case "SCHEMA_READINESS_QUERY_FAILED":
      return "Schema readiness query failed";
    default:
      return "Deep health checks passed";
  }
}

function getPublicHealthPayload(ok: boolean) {
  return {
    ok,
    service: publicServiceName,
  };
}

function getDeepHealthPayload(
  diagnosticsEnabled: boolean,
  payload: Record<string, unknown> & { ok: boolean }
) {
  if (!diagnosticsEnabled) {
    return getPublicHealthPayload(payload.ok);
  }

  return payload;
}

export async function getDeepHealthResponse(
  request: Request,
  deps: DeepHealthDeps = defaultDeps
) {
  const startTime = deps.now();
  const commit = resolveCommitSha();
  const diagnosticsEnabled = (await deps.resolveDiagnosticAccess(request)).isAdmin;

  if (!deps.hasServerSupabaseEnv()) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      getDeepHealthPayload(diagnosticsEnabled, {
        ok: false,
        state: "broken",
        stateLabel: "Monitoring needs attention",
        latencyMs: 0,
        supabaseReachable: false,
        schemaReady: false,
        reasonCode: "SUPABASE_ENV_MISSING" satisfies DeepHealthReasonCode,
        reasonLabel: getReasonLabel("SUPABASE_ENV_MISSING"),
        errorReason: "Supabase env vars missing",
        commit,
      }),
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
        getDeepHealthPayload(diagnosticsEnabled, {
          ok: false,
          state: "broken",
          stateLabel: "Monitoring needs attention",
          latencyMs,
          supabaseReachable: false,
          schemaReady: false,
          reasonCode: "SUPABASE_QUERY_FAILED" satisfies DeepHealthReasonCode,
          reasonLabel: getReasonLabel("SUPABASE_QUERY_FAILED"),
          errorReason: "Supabase query failed",
          commit,
        }),
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
        getDeepHealthPayload(diagnosticsEnabled, {
          ok: false,
          state: "broken",
          stateLabel: "Monitoring needs attention",
          latencyMs,
          supabaseReachable: true,
          schemaReady: false,
          reasonCode: (schema.queryError
            ? "SCHEMA_READINESS_QUERY_FAILED"
            : "SCHEMA_COLUMNS_MISSING") satisfies DeepHealthReasonCode,
          reasonLabel: getReasonLabel(
            schema.queryError ? "SCHEMA_READINESS_QUERY_FAILED" : "SCHEMA_COLUMNS_MISSING"
          ),
          errorReason: schema.queryError
            ? "Schema readiness check failed"
            : "Critical schema columns are missing",
          missingColumns: schema.missing.map((item) => `${item.table}.${item.column}`),
          checkedCount: schema.checkedCount,
          checkedAt: schema.checkedAt,
          commit,
        }),
        { status: 503 }
      );
    }

    return NextResponse.json(
      getDeepHealthPayload(diagnosticsEnabled, {
        ok: true,
        state: "healthy",
        stateLabel: "Deep health healthy",
        latencyMs,
        supabaseReachable: true,
        schemaReady: true,
        reasonCode: null,
        reasonLabel: getReasonLabel(null),
        checkedCount: schema.checkedCount,
        checkedAt: schema.checkedAt,
        commit,
      })
    );
  } catch (err) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json(
      getDeepHealthPayload(diagnosticsEnabled, {
        ok: false,
        state: "broken",
        stateLabel: "Monitoring needs attention",
        latencyMs: 0,
        supabaseReachable: false,
        schemaReady: false,
        reasonCode: "SUPABASE_QUERY_FAILED" satisfies DeepHealthReasonCode,
        reasonLabel: getReasonLabel("SUPABASE_QUERY_FAILED"),
        errorReason: "Supabase query failed",
        commit,
      }),
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return getDeepHealthResponse(request, defaultDeps);
}
