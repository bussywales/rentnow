import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { postPaymentsReconcileJobResponse } from "@/app/api/jobs/payments/reconcile/route";

function makeRequest(secret?: string) {
  return new NextRequest("http://localhost/api/jobs/payments/reconcile", {
    method: "POST",
    headers: secret ? { "x-cron-secret": secret } : undefined,
  });
}

void test("payments cron reconcile route returns 401 when secret missing or invalid", async () => {
  const deps = {
    hasServiceRoleEnv: () => true,
    hasPaystackServerEnv: () => true,
    createServiceRoleClient: () => ({} as never),
    getPaystackServerConfig: () => ({
      secretKey: "sk_test",
      publicKey: "pk_test",
      webhookSecret: "wh_test",
    }),
    getCronSecret: () => "cron_123",
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
  };

  const missing = await postPaymentsReconcileJobResponse(makeRequest(), deps as never);
  assert.equal(missing.status, 401);
  const wrong = await postPaymentsReconcileJobResponse(makeRequest("wrong"), deps as never);
  assert.equal(wrong.status, 401);
});

void test("payments cron reconcile route runs batch reconcile with valid secret", async () => {
  let runCalled = false;
  const response = await postPaymentsReconcileJobResponse(
    makeRequest("cron_abc"),
    {
      hasServiceRoleEnv: () => true,
      hasPaystackServerEnv: () => true,
      createServiceRoleClient: () => ({} as never),
      getPaystackServerConfig: () => ({
        secretKey: "sk_test",
        publicKey: "pk_test",
        webhookSecret: "wh_test",
      }),
      getCronSecret: () => "cron_abc",
      runPaymentsReconcileBatch: async (input: { mode: string; limit: number; ensureMissingPaymentFromVerify?: boolean }) => {
        runCalled = true;
        assert.equal(input.mode, "batch");
        assert.equal(input.limit, 50);
        assert.equal(input.ensureMissingPaymentFromVerify, true);
        return {
          scanned: 5,
          reconciled: 3,
          activated: 2,
          receiptsSent: 1,
          alreadyActivated: 1,
          receiptAlreadySent: 2,
          verifyFailedCount: 1,
          errorCount: 1,
          errors: ["ref_1: verification_failed"],
        };
      },
    } as never
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(runCalled, true);
  assert.equal(payload.ok, true);
  assert.equal(payload.scanned, 5);
  assert.equal(payload.reconciled, 3);
});
