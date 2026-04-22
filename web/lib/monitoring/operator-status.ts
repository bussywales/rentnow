import {
  getCriticalSchemaReadiness,
  type CriticalSchemaReadinessResult,
  type SchemaClient,
} from "@/lib/ops/critical-schema-readiness";

export type MonitoringCheckState = "healthy" | "degraded" | "broken";

export type MonitoringCheck = {
  key: "database" | "schema" | "sentry" | "release";
  state: MonitoringCheckState;
  label: string;
  detail: string;
  code: string | null;
};

export type OperatorMonitoringSnapshot = {
  checkedAt: string;
  runtimeEnvironment: string;
  commitSha: string | null;
  overallState: MonitoringCheckState;
  overallLabel: string;
  counts: {
    healthy: number;
    degraded: number;
    broken: number;
  };
  checks: {
    database: MonitoringCheck;
    schema: MonitoringCheck;
    sentry: MonitoringCheck;
    release: MonitoringCheck;
  };
  schema: CriticalSchemaReadinessResult;
  databaseError: string | null;
};

export type MonitoringClient = SchemaClient & {
  from: (table: "properties") => {
    select: (
      columns: string,
      options: { count: "exact"; head: true }
    ) => {
      limit: (count: number) => Promise<{
        error?: { message?: string | null } | null;
      }>;
    };
  };
};

type MonitoringRuntime = {
  runtimeEnvironment: string;
  commitSha: string | null;
  sentryServerConfigured: boolean;
  sentryClientConfigured: boolean;
  sentryReleaseConfigured: boolean;
};

function resolveCommitSha(env: NodeJS.ProcessEnv) {
  return (
    env.SENTRY_RELEASE ||
    env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    env.VERCEL_GIT_COMMIT_SHA ||
    env.COMMIT_SHA ||
    null
  );
}

export function getMonitoringRuntime(env: NodeJS.ProcessEnv = process.env): MonitoringRuntime {
  return {
    runtimeEnvironment: env.SENTRY_ENVIRONMENT || env.VERCEL_ENV || env.NODE_ENV || "development",
    commitSha: resolveCommitSha(env),
    sentryServerConfigured: Boolean(String(env.SENTRY_DSN || "").trim()),
    sentryClientConfigured: Boolean(String(env.NEXT_PUBLIC_SENTRY_DSN || "").trim()),
    sentryReleaseConfigured: Boolean(resolveCommitSha(env)),
  };
}

function buildDatabaseCheck(databaseError: string | null): MonitoringCheck {
  if (!databaseError) {
    return {
      key: "database",
      state: "healthy",
      label: "Database probe healthy",
      detail: "Properties probe succeeded.",
      code: null,
    };
  }

  return {
    key: "database",
    state: "broken",
    label: "Database probe failed",
    detail: databaseError,
    code: "DATABASE_PROBE_FAILED",
  };
}

function buildSchemaCheck(schema: CriticalSchemaReadinessResult): MonitoringCheck {
  if (schema.ready) {
    return {
      key: "schema",
      state: "healthy",
      label: "Schema readiness healthy",
      detail: `Verified ${schema.checkedCount} critical columns.`,
      code: null,
    };
  }

  if (schema.queryError) {
    return {
      key: "schema",
      state: "broken",
      label: "Schema readiness query failed",
      detail: schema.queryError,
      code: "SCHEMA_READINESS_QUERY_FAILED",
    };
  }

  const missingPreview = schema.missing
    .slice(0, 3)
    .map((item) => `${item.table}.${item.column}`)
    .join(", ");
  const remaining = schema.missing.length > 3 ? ` (+${schema.missing.length - 3} more)` : "";

  return {
    key: "schema",
    state: "broken",
    label: "Schema mismatch detected",
    detail: `Missing ${schema.missing.length} critical columns: ${missingPreview}${remaining}`,
    code: "SCHEMA_COLUMNS_MISSING",
  };
}

function buildSentryCheck(runtime: MonitoringRuntime): MonitoringCheck {
  if (runtime.sentryServerConfigured && runtime.sentryClientConfigured && runtime.sentryReleaseConfigured) {
    return {
      key: "sentry",
      state: "healthy",
      label: "Sentry capture ready",
      detail: "Server/client DSNs and release metadata are configured.",
      code: null,
    };
  }

  if (!runtime.sentryServerConfigured && !runtime.sentryClientConfigured) {
    return {
      key: "sentry",
      state: "broken",
      label: "Sentry capture missing",
      detail: "No server or client Sentry DSN detected.",
      code: "SENTRY_DSN_MISSING",
    };
  }

  const missingBits = [
    runtime.sentryServerConfigured ? null : "server DSN",
    runtime.sentryClientConfigured ? null : "client DSN",
    runtime.sentryReleaseConfigured ? null : "release metadata",
  ].filter(Boolean);

  return {
    key: "sentry",
    state: "degraded",
    label: "Sentry partially configured",
    detail: `Missing ${missingBits.join(", ")}.`,
    code: "SENTRY_PARTIAL_CONFIG",
  };
}

function buildReleaseCheck(runtime: MonitoringRuntime): MonitoringCheck {
  if (runtime.commitSha) {
    return {
      key: "release",
      state: "healthy",
      label: "Release metadata present",
      detail: `Commit ${runtime.commitSha.slice(0, 8)} detected.`,
      code: null,
    };
  }

  return {
    key: "release",
    state: "degraded",
    label: "Release metadata missing",
    detail: "No commit or release SHA detected in runtime env.",
    code: "RELEASE_METADATA_MISSING",
  };
}

function buildOverallState(checks: MonitoringCheck[]): Pick<
  OperatorMonitoringSnapshot,
  "overallState" | "overallLabel" | "counts"
> {
  const counts = checks.reduce(
    (acc, check) => {
      acc[check.state] += 1;
      return acc;
    },
    { healthy: 0, degraded: 0, broken: 0 }
  );

  if (counts.broken > 0) {
    return {
      overallState: "broken",
      overallLabel: "Monitoring needs attention",
      counts,
    };
  }

  if (counts.degraded > 0) {
    return {
      overallState: "degraded",
      overallLabel: "Monitoring partially degraded",
      counts,
    };
  }

  return {
    overallState: "healthy",
    overallLabel: "All monitoring checks healthy",
    counts,
  };
}

export async function getOperatorMonitoringSnapshot(
  client: MonitoringClient,
  env: NodeJS.ProcessEnv = process.env
): Promise<OperatorMonitoringSnapshot> {
  const checkedAt = new Date().toISOString();
  const runtime = getMonitoringRuntime(env);
  const [{ error }, schema] = await Promise.all([
    client.from("properties").select("id", { count: "exact", head: true }).limit(1),
    getCriticalSchemaReadiness(client),
  ]);

  const checks = {
    database: buildDatabaseCheck(error?.message?.trim() || null),
    schema: buildSchemaCheck(schema),
    sentry: buildSentryCheck(runtime),
    release: buildReleaseCheck(runtime),
  };
  const summary = buildOverallState(Object.values(checks));

  return {
    checkedAt,
    runtimeEnvironment: runtime.runtimeEnvironment,
    commitSha: runtime.commitSha,
    overallState: summary.overallState,
    overallLabel: summary.overallLabel,
    counts: summary.counts,
    checks,
    schema,
    databaseError: error?.message?.trim() || null,
  };
}
