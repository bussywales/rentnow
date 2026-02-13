import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import { postAdminPaymentsReconcileResponse } from "@/app/api/admin/payments/reconcile/route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/payments/reconcile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

void test("admin reconcile route supports reference mode and preserves idempotent semantics", async () => {
  let callCount = 0;
  const response1 = await postAdminPaymentsReconcileResponse(
    makeRequest({ reference: "ref_123" }),
    {
      requireRole: async () =>
        ({
          ok: true,
          role: "admin",
          user: { id: "admin_1", email: "admin@example.com" },
          supabase: {} as never,
        }) as never,
      hasServiceRoleEnv: () => true,
      hasPaystackServerEnv: () => true,
      createServiceRoleClient: () => ({} as never),
      getPaystackServerConfig: () => ({
        secretKey: "sk_test",
        publicKey: "pk_test",
        webhookSecret: "wh_test",
      }),
      verifyTransaction: async () => ({
        ok: true,
        status: "success",
        amountMinor: 5000,
        currency: "NGN",
        paidAt: new Date().toISOString(),
        authorizationCode: "AUTH",
        email: "owner@example.com",
        raw: null,
      }),
      getPaymentWithPurchaseByReference: async () => null,
      sendFeaturedReceiptIfNeeded: async () => ({ sent: false, alreadySent: false, reason: "noop" }),
      runPaymentsReconcileBatch: async () => ({
        scanned: 0,
        reconciled: 0,
        activated: 0,
        receiptsSent: 0,
        alreadyActivated: 0,
        receiptAlreadySent: 0,
        verifyFailedCount: 0,
        errorCount: 0,
        errors: [],
      }),
      reconcilePaystackReference: async () => {
        callCount += 1;
        if (callCount === 1) {
          return {
            ok: true,
            reason: "reconciled",
            paymentStatus: "succeeded",
            activated: true,
            alreadyActivated: false,
            receiptSent: true,
            receiptAlreadySent: false,
            verifyFailed: false,
          };
        }
        return {
          ok: true,
          reason: "reconciled",
          paymentStatus: "succeeded",
          activated: false,
          alreadyActivated: true,
          receiptSent: false,
          receiptAlreadySent: true,
          verifyFailed: false,
        };
      },
    } as never
  );

  assert.equal(response1.status, 200);
  const payload1 = await response1.json();
  assert.equal(payload1.ok, true);
  assert.equal(payload1.activated, true);
  assert.equal(payload1.alreadyActivated, false);
  assert.equal(payload1.receiptSent, true);

  const response2 = await postAdminPaymentsReconcileResponse(
    makeRequest({ reference: "ref_123" }),
    {
      requireRole: async () =>
        ({
          ok: true,
          role: "admin",
          user: { id: "admin_1", email: "admin@example.com" },
          supabase: {} as never,
        }) as never,
      hasServiceRoleEnv: () => true,
      hasPaystackServerEnv: () => true,
      createServiceRoleClient: () => ({} as never),
      getPaystackServerConfig: () => ({
        secretKey: "sk_test",
        publicKey: "pk_test",
        webhookSecret: "wh_test",
      }),
      verifyTransaction: async () => ({
        ok: true,
        status: "success",
        amountMinor: 5000,
        currency: "NGN",
        paidAt: new Date().toISOString(),
        authorizationCode: "AUTH",
        email: "owner@example.com",
        raw: null,
      }),
      getPaymentWithPurchaseByReference: async () => null,
      sendFeaturedReceiptIfNeeded: async () => ({ sent: false, alreadySent: false, reason: "noop" }),
      runPaymentsReconcileBatch: async () => ({
        scanned: 0,
        reconciled: 0,
        activated: 0,
        receiptsSent: 0,
        alreadyActivated: 0,
        receiptAlreadySent: 0,
        verifyFailedCount: 0,
        errorCount: 0,
        errors: [],
      }),
      reconcilePaystackReference: async () => ({
        ok: true,
        reason: "reconciled",
        paymentStatus: "succeeded",
        activated: false,
        alreadyActivated: true,
        receiptSent: false,
        receiptAlreadySent: true,
        verifyFailed: false,
      }),
    } as never
  );
  assert.equal(response2.status, 200);
  const payload2 = await response2.json();
  assert.equal(payload2.alreadyActivated, true);
  assert.equal(payload2.receiptAlreadySent, true);
});

void test("admin reconcile route supports stuck and receipts modes", async () => {
  const makeDeps = (expectedMode: "stuck" | "receipts") =>
    ({
      requireRole: async () =>
        ({
          ok: true,
          role: "admin",
          user: { id: "admin_1", email: "admin@example.com" },
          supabase: {} as never,
        }) as never,
      hasServiceRoleEnv: () => true,
      hasPaystackServerEnv: () => true,
      createServiceRoleClient: () => ({} as never),
      getPaystackServerConfig: () => ({
        secretKey: "sk_test",
        publicKey: "pk_test",
        webhookSecret: "wh_test",
      }),
      verifyTransaction: async () => ({
        ok: true,
        status: "success",
        amountMinor: 0,
        currency: "NGN",
        paidAt: null,
        authorizationCode: null,
        email: null,
        raw: null,
      }),
      getPaymentWithPurchaseByReference: async () => null,
      sendFeaturedReceiptIfNeeded: async () => ({ sent: false, alreadySent: false, reason: "noop" }),
      reconcilePaystackReference: async () => ({
        ok: true,
        reason: "noop",
        paymentStatus: "succeeded",
        activated: false,
        alreadyActivated: false,
        receiptSent: false,
        receiptAlreadySent: false,
        verifyFailed: false,
      }),
      runPaymentsReconcileBatch: async (input: { mode: string }) => {
        assert.equal(input.mode, expectedMode);
        return {
          scanned: 4,
          reconciled: 3,
          activated: 2,
          receiptsSent: 1,
          alreadyActivated: 1,
          receiptAlreadySent: 2,
          verifyFailedCount: 1,
          errorCount: 1,
          errors: ["ref_x: verify_failed"],
        };
      },
    }) as never;

  const stuckResponse = await postAdminPaymentsReconcileResponse(
    makeRequest({ mode: "stuck" }),
    makeDeps("stuck")
  );
  assert.equal(stuckResponse.status, 200);
  const stuckPayload = await stuckResponse.json();
  assert.equal(stuckPayload.mode, "stuck");
  assert.equal(stuckPayload.scanned, 4);

  const receiptsResponse = await postAdminPaymentsReconcileResponse(
    makeRequest({ mode: "receipts" }),
    makeDeps("receipts")
  );
  assert.equal(receiptsResponse.status, 200);
  const receiptsPayload = await receiptsResponse.json();
  assert.equal(receiptsPayload.mode, "receipts");
  assert.equal(receiptsPayload.reconciled, 3);
});

void test("admin reconcile returns auth response for non-admin users", async () => {
  const response = await postAdminPaymentsReconcileResponse(makeRequest({ reference: "ref_999" }), {
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as never,
    hasServiceRoleEnv: () => true,
    hasPaystackServerEnv: () => true,
    createServiceRoleClient: () => ({} as never),
    getPaystackServerConfig: () => ({ secretKey: "sk_test", publicKey: "pk_test", webhookSecret: "whsec_test" }),
    verifyTransaction: async () => ({
      ok: false,
      status: "failed",
      amountMinor: 0,
      currency: "NGN",
      paidAt: null,
      authorizationCode: null,
      email: null,
      raw: null,
    }),
    getPaymentWithPurchaseByReference: async () => null,
    sendFeaturedReceiptIfNeeded: async () => ({ sent: false, alreadySent: false, reason: "noop" }),
    reconcilePaystackReference: async () => ({
      ok: false,
      reason: "forbidden",
      paymentStatus: null,
      activated: false,
      alreadyActivated: false,
      receiptSent: false,
      receiptAlreadySent: false,
      verifyFailed: false,
    }),
    runPaymentsReconcileBatch: async () => ({
      scanned: 0,
      reconciled: 0,
      activated: 0,
      receiptsSent: 0,
      alreadyActivated: 0,
      receiptAlreadySent: 0,
      verifyFailedCount: 0,
      errorCount: 0,
      errors: [],
    }),
  } as never);

  assert.equal(response.status, 403);
});
