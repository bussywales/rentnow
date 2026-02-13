import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import {
  getPaystackServerConfig,
  hasPaystackServerEnv,
  verifyTransaction,
} from "@/lib/payments/paystack.server";
import {
  reconcilePaystackReference,
  runPaymentsReconcileBatch,
  type PaymentsReconcileMode,
} from "@/lib/payments/reconcile.server";
import {
  getPaymentWithPurchaseByReference,
} from "@/lib/payments/featured-payments.server";
import { sendFeaturedReceiptIfNeeded } from "@/lib/payments/featured-payments-ops.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/payments/reconcile";

const referenceSchema = z.object({
  reference: z.string().min(4).max(200),
});

const modeSchema = z.object({
  mode: z.enum(["batch", "stuck", "receipts"]),
  limit: z.number().int().min(1).max(200).optional(),
});

export type ReconcileModePayload = {
  mode: PaymentsReconcileMode;
  limit?: number;
};

type ReconcileDeps = {
  requireRole: typeof requireRole;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  hasPaystackServerEnv: typeof hasPaystackServerEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getPaystackServerConfig: typeof getPaystackServerConfig;
  verifyTransaction: typeof verifyTransaction;
  getPaymentWithPurchaseByReference: typeof getPaymentWithPurchaseByReference;
  sendFeaturedReceiptIfNeeded: typeof sendFeaturedReceiptIfNeeded;
  reconcilePaystackReference: typeof reconcilePaystackReference;
  runPaymentsReconcileBatch: typeof runPaymentsReconcileBatch;
};

const defaultDeps: ReconcileDeps = {
  requireRole,
  hasServiceRoleEnv,
  hasPaystackServerEnv,
  createServiceRoleClient,
  getPaystackServerConfig,
  verifyTransaction,
  getPaymentWithPurchaseByReference,
  sendFeaturedReceiptIfNeeded,
  reconcilePaystackReference,
  runPaymentsReconcileBatch,
};

function readPayload(
  raw: Record<string, unknown>
): { kind: "reference"; reference: string } | { kind: "mode"; mode: PaymentsReconcileMode; limit?: number } | null {
  const referenceParsed = referenceSchema.safeParse(raw);
  if (referenceParsed.success) {
    return { kind: "reference", reference: referenceParsed.data.reference.trim() };
  }
  const modeParsed = modeSchema.safeParse(raw);
  if (modeParsed.success) {
    return {
      kind: "mode",
      mode: modeParsed.data.mode,
      limit: modeParsed.data.limit,
    };
  }
  return null;
}

export async function postAdminPaymentsReconcileResponse(
  request: NextRequest,
  deps: ReconcileDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ ok: false, reason: "service_role_missing" }, { status: 503 });
  }
  if (!deps.hasPaystackServerEnv()) {
    return NextResponse.json({ ok: false, reason: "paystack_not_configured" }, { status: 503 });
  }

  const rawPayload = ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
  const parsedPayload = readPayload(rawPayload);
  if (!parsedPayload) {
    return NextResponse.json({ ok: false, reason: "invalid_payload" }, { status: 422 });
  }

  const client = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
  const paystackConfig = deps.getPaystackServerConfig();
  const secretKey = paystackConfig.secretKey || "";

  if (parsedPayload.kind === "mode") {
    const summary = await deps.runPaymentsReconcileBatch({
      client,
      secretKey,
      mode: parsedPayload.mode,
      limit: parsedPayload.limit,
      ensureMissingPaymentFromVerify: true,
    });

    return NextResponse.json({
      ok: true,
      mode: parsedPayload.mode,
      ...summary,
    });
  }

  const result = await deps.reconcilePaystackReference({
    client,
    reference: parsedPayload.reference,
    secretKey,
    ensureMissingPaymentFromVerify: true,
    verifyTransactionFn: deps.verifyTransaction,
    getPaymentWithPurchaseByReferenceFn: deps.getPaymentWithPurchaseByReference,
    sendFeaturedReceiptIfNeededFn: deps.sendFeaturedReceiptIfNeeded,
  });

  if (!result.ok && result.reason === "payment_not_found") {
    return NextResponse.json(
      {
        ok: false,
        reason: "payment_not_found",
        paymentStatus: null,
        activated: false,
        alreadyActivated: false,
        receiptSent: false,
        receiptAlreadySent: false,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: result.ok,
    reason: result.reason,
    paymentStatus: result.paymentStatus,
    activated: result.activated,
    alreadyActivated: result.alreadyActivated,
    receiptSent: result.receiptSent,
    receiptAlreadySent: result.receiptAlreadySent,
  });
}

export async function POST(request: NextRequest) {
  return postAdminPaymentsReconcileResponse(request);
}

export const dynamic = "force-dynamic";
