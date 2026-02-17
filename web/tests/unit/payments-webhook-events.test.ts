import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  insertPaymentWebhookEvent,
} from "@/lib/payments/featured-payments-ops.server";
import { postPaystackWebhookResponse } from "@/app/api/webhooks/paystack/route";
import type { ShortletPaymentBookingContext } from "@/lib/shortlet/payments.server";

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
      getShortletPaymentByReference: async () => null,
      getShortletPaymentCheckoutContextByBookingId: async () => null,
      resolveShortletBookingIdFromPaystackPayload: () => null,
      upsertShortletPaymentIntent: async (input) => {
        void input;
        return { payment: null as never, alreadySucceeded: false };
      },
      markShortletPaymentFailed: async () => undefined,
      markShortletPaymentSucceededAndConfirmBooking: async () => ({ ok: false as const, reason: "PAYMENT_NOT_FOUND" }),
      dispatchShortletPaymentSuccess: async () => undefined,
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.duplicate, true);
  assert.equal(validateCalled, false);
});

void test("webhook route rejects invalid signatures", async () => {
  const markedErrors: string[] = [];
  const response = await postPaystackWebhookResponse(
    new NextRequest("http://localhost/api/webhooks/paystack", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": "bad_sig" },
      body: JSON.stringify({
        event: "charge.success",
        data: { reference: "shb_ps_11111111-1111-4111-8111-111111111111_123" },
      }),
    }),
    {
      hasServiceRoleEnv: () => true,
      hasPaystackServerEnv: () => true,
      createServiceRoleClient: () => ({} as never),
      getPaystackServerConfig: () => ({ secretKey: "sk_test", publicKey: "pk_test", webhookSecret: "wh_test" }),
      hashWebhookPayload: () => "hash_123",
      insertPaymentWebhookEvent: async () => ({ id: "evt_1", duplicate: false }),
      markPaymentWebhookEventError: async ({ error }) => {
        markedErrors.push(error);
      },
      markPaymentWebhookEventProcessed: async () => undefined,
      validateWebhookSignature: () => false,
      getPaymentWithPurchaseByReference: async () => null,
      verifyTransaction: async () => ({
        ok: true,
        status: "success",
        amountMinor: 120000,
        currency: "NGN",
        paidAt: null,
        authorizationCode: null,
        email: null,
        raw: { data: { metadata: { booking_id: "11111111-1111-4111-8111-111111111111" } } },
      }),
      sendFeaturedReceiptIfNeeded: async () => ({ sent: false, alreadySent: false, reason: "noop" }),
      getShortletPaymentByReference: async () => null,
      getShortletPaymentCheckoutContextByBookingId: async () => null,
      resolveShortletBookingIdFromPaystackPayload: () => null,
      upsertShortletPaymentIntent: async (input) => {
        void input;
        return { payment: null as never, alreadySucceeded: false };
      },
      markShortletPaymentFailed: async () => undefined,
      markShortletPaymentSucceededAndConfirmBooking: async () => ({ ok: false as const, reason: "PAYMENT_NOT_FOUND" }),
      dispatchShortletPaymentSuccess: async () => undefined,
    }
  );

  assert.equal(response.status, 401);
  assert.deepEqual(markedErrors, ["invalid_signature"]);
});

void test("webhook route confirms shortlet booking from paystack reference flow", async () => {
  let upsertCalled = false;
  let transitionCalled = false;
  let dispatched = false;
  const bookingContext: ShortletPaymentBookingContext = {
    bookingId: "11111111-1111-4111-8111-111111111111",
    propertyId: "22222222-2222-4222-8222-222222222222",
    guestUserId: "tenant_1",
    hostUserId: "host_1",
    status: "pending_payment",
    checkIn: "2026-03-20",
    checkOut: "2026-03-23",
    nights: 3,
    totalAmountMinor: 120000,
    currency: "NGN",
    bookingMode: "request",
    listingTitle: "Lekki Suite",
    city: "Lagos",
    countryCode: "NG",
    paymentReference: null,
    payment: null,
  };

  const response = await postPaystackWebhookResponse(
    new NextRequest("http://localhost/api/webhooks/paystack", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": "good_sig" },
      body: JSON.stringify({
        event: "charge.success",
        data: { reference: "shb_ps_11111111-1111-4111-8111-111111111111_123" },
      }),
    }),
    {
      hasServiceRoleEnv: () => true,
      hasPaystackServerEnv: () => true,
      createServiceRoleClient: () => ({} as never),
      getPaystackServerConfig: () => ({ secretKey: "sk_test", publicKey: "pk_test", webhookSecret: "wh_test" }),
      hashWebhookPayload: () => "hash_123",
      insertPaymentWebhookEvent: async () => ({ id: "evt_1", duplicate: false }),
      markPaymentWebhookEventError: async () => undefined,
      markPaymentWebhookEventProcessed: async () => undefined,
      validateWebhookSignature: () => true,
      getPaymentWithPurchaseByReference: async () => null,
      verifyTransaction: async () => ({
        ok: true,
        status: "success",
        amountMinor: 120000,
        currency: "NGN",
        paidAt: "2026-02-17T10:00:00.000Z",
        authorizationCode: "AUTH_123",
        email: "tenant@example.com",
        raw: {
          data: {
            id: 12345,
            gateway_response: "Successful",
            authorization: { authorization_code: "AUTH_123" },
            metadata: { booking_id: "11111111-1111-4111-8111-111111111111" },
          },
        },
      }),
      sendFeaturedReceiptIfNeeded: async () => ({ sent: false, alreadySent: false, reason: "noop" }),
      getShortletPaymentByReference: async () => null,
      getShortletPaymentCheckoutContextByBookingId: async () => bookingContext,
      resolveShortletBookingIdFromPaystackPayload: () => "11111111-1111-4111-8111-111111111111",
      upsertShortletPaymentIntent: async (input) => {
        void input;
        upsertCalled = true;
        return { payment: null as never, alreadySucceeded: false };
      },
      markShortletPaymentFailed: async () => undefined,
      markShortletPaymentSucceededAndConfirmBooking: async () => {
        transitionCalled = true;
        return {
          ok: true as const,
          payment: null as never,
          booking: { ...bookingContext, status: "pending", transitioned: true },
          alreadySucceeded: false,
        };
      },
      dispatchShortletPaymentSuccess: async () => {
        dispatched = true;
      },
    }
  );

  const payload = (await response.json()) as { ok?: boolean; shortlet?: boolean };
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.shortlet, true);
  assert.equal(upsertCalled, true);
  assert.equal(transitionCalled, true);
  assert.equal(dispatched, true);
});
