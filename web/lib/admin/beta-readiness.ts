export type BetaReadinessSnapshot = {
  blockers: string[];
  warnings: string[];
  flags: {
    supabaseReady: boolean;
    serviceRoleReady: boolean;
    pushConfigured: boolean;
    missingPhotosAvailable: boolean;
  };
  migrationStatus: string;
};

type BetaReadinessInput = {
  supabaseReady: boolean;
  serviceRoleReady: boolean;
  pushConfigured: boolean;
  missingPhotosAvailable: boolean;
};

export function buildBetaReadinessSnapshot(input: BetaReadinessInput): BetaReadinessSnapshot {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!input.supabaseReady) {
    blockers.push("Supabase env vars missing (listings unavailable).");
  }
  if (!input.serviceRoleReady) {
    warnings.push("Service role key missing (admin telemetry degraded).");
  }
  if (!input.pushConfigured) {
    warnings.push("Push is not configured (push alerts unavailable).");
  }
  if (!input.missingPhotosAvailable) {
    warnings.push("Missing photos metric not available (no DB source).");
  }

  return {
    blockers,
    warnings,
    flags: input,
    migrationStatus: "Verify in docs (web/docs/ops/supabase-migrations.md).",
  };
}
