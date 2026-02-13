import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getPaystackServerConfig, hasPaystackServerEnv } from "@/lib/payments/paystack.server";
import { runPaymentsReconcileBatch } from "@/lib/payments/reconcile.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/jobs/payments/reconcile";

export type PaymentsReconcileJobDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  hasPaystackServerEnv: typeof hasPaystackServerEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getPaystackServerConfig: typeof getPaystackServerConfig;
  getCronSecret: () => string;
  runPaymentsReconcileBatch: typeof runPaymentsReconcileBatch;
};

const defaultDeps: PaymentsReconcileJobDeps = {
  hasServiceRoleEnv,
  hasPaystackServerEnv,
  createServiceRoleClient,
  getPaystackServerConfig,
  getCronSecret: () => process.env.CRON_SECRET || "",
  runPaymentsReconcileBatch,
};

function hasValidCronSecret(request: NextRequest, expected: string) {
  if (!expected) return false;
  return request.headers.get("x-cron-secret") === expected;
}

export async function postPaymentsReconcileJobResponse(
  request: NextRequest,
  deps: PaymentsReconcileJobDeps = defaultDeps
) {
  const expectedSecret = deps.getCronSecret();
  if (!hasValidCronSecret(request, expectedSecret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ ok: false, error: "Service role not configured." }, { status: 503 });
  }

  if (!deps.hasPaystackServerEnv()) {
    return NextResponse.json({ ok: false, error: "Paystack not configured." }, { status: 503 });
  }

  const client = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
  const paystackConfig = deps.getPaystackServerConfig();
  const secretKey = paystackConfig.secretKey || "";

  try {
    const summary = await deps.runPaymentsReconcileBatch({
      client,
      secretKey,
      mode: "batch",
      limit: 50,
      ensureMissingPaymentFromVerify: true,
    });

    return NextResponse.json({
      ok: true,
      route: routeLabel,
      ...summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "payments_reconcile_job_failed",
        scanned: 0,
        reconciled: 0,
        activated: 0,
        receiptsSent: 0,
        alreadyActivated: 0,
        receiptAlreadySent: 0,
        verifyFailedCount: 0,
        errorCount: 1,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return postPaymentsReconcileJobResponse(request);
}

export const dynamic = "force-dynamic";
