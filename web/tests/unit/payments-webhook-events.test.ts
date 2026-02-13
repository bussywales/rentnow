import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  insertPaymentWebhookEvent,
} from "@/lib/payments/featured-payments-ops.server";
import { postPaystackWebhookResponse } from "@/app/api/webhooks/paystack/route";

void test("insertPaymentWebhookEvent treats duplicate payload hashes as idempotent", async () => {
  const client = {
    from: () => ({
      insert: () => ({
        select: () => ({
          maybeSingle: async () => ({
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          }),
        }),
      }),
    }),
  };

  const result = await insertPaymentWebhookEvent({
    client: client as never,
    provider: "paystack",
    event: "charge.success",
    reference: "ref_123",
    signature: "sig_123",
    payload: { event: "charge.success", data: { reference: "ref_123" } },
    payloadHash: "hash_123",
  });

  assert.equal(result.duplicate, true);
  assert.equal(result.id, null);
});

void test("webhook route short-circuits duplicate payloads before processing", async () => {
  let validateCalled = false;
  const response = await postPaystackWebhookResponse(
    new NextRequest("http://localhost/api/webhooks/paystack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "charge.success",
        data: { reference: "ref_123" },
      }),
    }),
    {
      hasServiceRoleEnv: () => true,
      hasPaystackServerEnv: () => true,
      createServiceRoleClient: () => ({} as never),
      getPaystackServerConfig: () => ({ secretKey: "sk_test", publicKey: "pk_test", webhookSecret: "wh_test" }),
      hashWebhookPayload: () => "hash_123",
      insertPaymentWebhookEvent: async () => ({ id: null, duplicate: true }),
      markPaymentWebhookEventError: async () => undefined,
      markPaymentWebhookEventProcessed: async () => undefined,
      validateWebhookSignature: () => {
        validateCalled = true;
        return true;
      },
      getPaymentWithPurchaseByReference: async () => null,
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
      sendFeaturedReceiptIfNeeded: async () => ({ sent: false, alreadySent: false, reason: "noop" }),
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.duplicate, true);
  assert.equal(validateCalled, false);
});
