import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { postInternalShortletReconcilePaymentsResponse } from "@/app/api/internal/shortlet/reconcile-payments/route";
import type { ShortletPaymentReconcileRow } from "@/lib/shortlet/payments.server";

function makeCandidate(
  overrides: Partial<ShortletPaymentReconcileRow> = {}
): ShortletPaymentReconcileRow {
  return {
    id: "pay_1",
    bookingId: "11111111-1111-4111-8111-111111111111",
    provider: "paystack",
    providerReference: "shb_ps_11111111-1111-4111-8111-111111111111_100",
    status: "initiated",
    currency: "NGN",
    amountTotalMinor: 120000,
    verifyAttempts: 0,
    needsReconcile: false,
    reconcileReason: null,
    reconcileLockedUntil: null,
    providerPayload: {},
    createdAt: "2026-02-17T00:00:00.000Z",
    updatedAt: "2026-02-17T00:00:00.000Z",
    lastVerifiedAt: null,
    providerEventId: null,
    providerTxId: null,
    ...overrides,
  };
}

void test("internal shortlet reconcile route clears terminal succeeded rows and reconciles stale initiated rows", async () => {
  const cleared: string[] = [];
  const reconciled: string[] = [];
  const verifyRefs: string[] = [];

  const terminalCandidate = makeCandidate({
    id: "pay_terminal",
    bookingId: "33333333-3333-4333-8333-333333333333",
    status: "succeeded",
  });
  const initiatedCandidate = makeCandidate({
    id: "pay_initiated",
    bookingId: "44444444-4444-4444-8444-444444444444",
    status: "initiated",
  });

  const request = new NextRequest(
    "http://localhost/api/internal/shortlet/reconcile-payments",
    {
      method: "POST",
      headers: { "x-cron-secret": "cron_123" },
    }
  );

  const response = await postInternalShortletReconcilePaymentsResponse(request, {
    hasServiceRoleEnv: () => true,
    hasPaystackServerEnv: () => true,
    createServiceRoleClient: () => ({} as never),
    getCronSecret: () => "cron_123",
    getPaystackServerConfig: () => ({
      secretKey: "sk_test",
      publicKey: "pk_test",
      webhookSecret: "wh_test",
    }),
    verifyTransaction: async ({ reference }) => {
      verifyRefs.push(reference);
      return {
        ok: true,
        status: "success",
        amountMinor: 120000,
        currency: "NGN",
        paidAt: "2026-02-17T10:00:00.000Z",
        authorizationCode: "AUTH_1",
        email: "tenant@example.com",
        raw: { data: { id: 123 } },
      };
    },
    getProviderModes: async () => ({
      stripeMode: "test",
      paystackMode: "test",
      flutterwaveMode: "test",
    }),
    getStripeConfigForMode: () => ({
      mode: "test",
      secretKey: "",
      webhookSecret: "",
    }),
    getStripeClient: () => ({} as never),
    listShortletPaymentsForReconcile: async () => [terminalCandidate, initiatedCandidate],
    detectReconcileSchemaSupport: async () => true,
    lockShortletPaymentForReconcile: async () => true,
    getShortletPaymentCheckoutContextByBookingId: async ({ bookingId }) => {
      if (bookingId === terminalCandidate.bookingId) {
        return {
          bookingId,
          propertyId: "prop_1",
          guestUserId: "guest_1",
          hostUserId: "host_1",
          status: "confirmed",
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
      }

      return {
        bookingId,
        propertyId: "prop_2",
        guestUserId: "guest_1",
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
    },
    clearShortletPaymentReconcileState: async ({ paymentId }) => {
      cleared.push(paymentId);
    },
    markShortletPaymentNeedsReconcile: async () => undefined,
    markShortletPaymentFailed: async () => undefined,
    markShortletPaymentSucceededAndConfirmBooking: async ({ providerReference }) => {
      reconciled.push(providerReference);
      return {
        ok: true as const,
        payment: null as never,
        booking: {
          bookingId: initiatedCandidate.bookingId,
          propertyId: "prop_2",
          guestUserId: "guest_1",
          hostUserId: "host_1",
          checkIn: "2026-03-20",
          checkOut: "2026-03-23",
          nights: 3,
          totalAmountMinor: 120000,
          currency: "NGN",
          listingTitle: "Lekki Suite",
          city: "Lagos",
          countryCode: "NG",
          status: "pending",
          bookingMode: "request",
          transitioned: true,
        },
        alreadySucceeded: false,
      };
    },
    now: () => new Date("2026-02-17T10:00:00.000Z"),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.scanned, 2);
  assert.equal(payload.locked, 2);
  assert.equal(payload.skippedTerminal, 1);
  assert.equal(payload.reconciled, 1);
  assert.deepEqual(cleared, ["pay_terminal"]);
  assert.deepEqual(reconciled, [initiatedCandidate.providerReference]);
  assert.deepEqual(verifyRefs, [initiatedCandidate.providerReference]);
});

void test("internal shortlet reconcile route degrades gracefully when reconcile columns are missing", async () => {
  const request = new NextRequest(
    "http://localhost/api/internal/shortlet/reconcile-payments",
    {
      method: "POST",
      headers: { "x-cron-secret": "cron_123" },
    }
  );

  const candidate = makeCandidate({
    id: "pay_legacy",
    bookingId: "55555555-5555-4555-8555-555555555555",
    providerReference: "shb_ps_55555555-5555-4555-8555-555555555555_100",
  });

  let reconcileListCalled = 0;
  let lockCalled = 0;
  let legacyListCalled = 0;
  let canonicalCalled = 0;

  const response = await postInternalShortletReconcilePaymentsResponse(request, {
    hasServiceRoleEnv: () => true,
    hasPaystackServerEnv: () => true,
    createServiceRoleClient: () => ({} as never),
    getCronSecret: () => "cron_123",
    getPaystackServerConfig: () => ({
      secretKey: "sk_test",
      publicKey: "pk_test",
      webhookSecret: "wh_test",
    }),
    verifyTransaction: async () => ({
      ok: true,
      status: "success",
      amountMinor: 120000,
      currency: "NGN",
      paidAt: "2026-02-17T10:00:00.000Z",
      authorizationCode: "AUTH_legacy",
      email: "tenant@example.com",
      raw: { data: { id: 987 } },
    }),
    getProviderModes: async () => ({
      stripeMode: "test",
      paystackMode: "test",
      flutterwaveMode: "test",
    }),
    getStripeConfigForMode: () => ({
      mode: "test",
      secretKey: "",
      webhookSecret: "",
    }),
    getStripeClient: () => ({} as never),
    listShortletPaymentsForReconcile: async () => {
      reconcileListCalled += 1;
      return [];
    },
    listShortletPaymentsForReconcileLegacy: async () => {
      legacyListCalled += 1;
      return [candidate];
    },
    lockShortletPaymentForReconcile: async () => {
      lockCalled += 1;
      return true;
    },
    detectReconcileSchemaSupport: async () => false,
    getShortletPaymentCheckoutContextByBookingId: async ({ bookingId }) => ({
      bookingId,
      propertyId: "prop_legacy",
      guestUserId: "guest_legacy",
      hostUserId: "host_legacy",
      status: "pending_payment",
      checkIn: "2026-03-20",
      checkOut: "2026-03-23",
      nights: 3,
      totalAmountMinor: 120000,
      currency: "NGN",
      bookingMode: "request",
      listingTitle: "Legacy Suite",
      city: "Lagos",
      countryCode: "NG",
      paymentReference: null,
      payment: null,
    }),
    clearShortletPaymentReconcileState: async () => undefined,
    markShortletPaymentNeedsReconcile: async () => undefined,
    markShortletPaymentFailed: async () => undefined,
    markShortletPaymentSucceededAndConfirmBooking: async () => {
      canonicalCalled += 1;
      return {
        ok: true as const,
        payment: null as never,
        booking: {
          bookingId: candidate.bookingId,
          propertyId: "prop_legacy",
          guestUserId: "guest_legacy",
          hostUserId: "host_legacy",
          checkIn: "2026-03-20",
          checkOut: "2026-03-23",
          nights: 3,
          totalAmountMinor: 120000,
          currency: "NGN",
          listingTitle: "Legacy Suite",
          city: "Lagos",
          countryCode: "NG",
          status: "pending",
          bookingMode: "request",
          transitioned: true,
        },
        alreadySucceeded: false,
      };
    },
    now: () => new Date("2026-02-17T10:00:00.000Z"),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.schemaMode, "legacy_no_reconcile_columns");
  assert.equal(payload.scanned, 1);
  assert.equal(payload.locked, 0);
  assert.equal(payload.reconciled, 1);
  assert.equal(legacyListCalled, 1);
  assert.equal(reconcileListCalled, 0);
  assert.equal(lockCalled, 0);
  assert.equal(canonicalCalled, 1);
});
