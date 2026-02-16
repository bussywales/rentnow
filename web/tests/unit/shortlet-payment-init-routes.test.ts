import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  postInitShortletPaystackResponse,
  type InitShortletPaystackDeps,
} from "@/app/api/shortlet/payments/paystack/init/route";
import {
  postInitShortletStripeResponse,
  type InitShortletStripeDeps,
} from "@/app/api/shortlet/payments/stripe/init/route";
import type { ShortletPaymentBookingContext } from "@/lib/shortlet/payments.server";

function makeRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeBookingContext(overrides: Partial<ShortletPaymentBookingContext> = {}): ShortletPaymentBookingContext {
  return {
    bookingId: "11111111-1111-4111-8111-111111111111",
    propertyId: "22222222-2222-4222-8222-222222222222",
    guestUserId: "tenant-1",
    hostUserId: "host-1",
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
    ...overrides,
  };
}

void test("paystack init enforces booking ownership", async () => {
  const deps: InitShortletPaystackDeps = {
    hasServiceRoleEnv: () => true,
    hasPaystackServerEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "tenant-1", email: "tenant@example.com" } as never,
        role: "tenant",
        supabase: {} as never,
      }) as Awaited<ReturnType<InitShortletPaystackDeps["requireRole"]>>,
    getShortletPaymentsProviderFlags: async () => ({ stripeEnabled: true, paystackEnabled: true }),
    getShortletPaymentCheckoutContext: async () => null,
    getSiteUrl: async () => "https://example.com",
    getPaystackServerConfig: () => ({ secretKey: "sk_test", publicKey: "pk_test", webhookSecret: "wh_test" }),
    initializeTransaction: async () => ({
      authorizationUrl: "https://paystack.example/checkout",
      accessCode: "ac_1",
      reference: "ps_ref_1",
    }),
    upsertShortletPaymentIntent: async () => ({
      payment: makeBookingContext().payment as never,
      alreadySucceeded: false,
    }),
  };

  const response = await postInitShortletPaystackResponse(
    makeRequest("http://localhost/api/shortlet/payments/paystack/init", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    }),
    deps
  );

  assert.equal(response.status, 404);
});

void test("stripe init rejects already paid bookings", async () => {
  let upsertCalled = false;

  const deps: InitShortletStripeDeps = {
    hasServiceRoleEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "tenant-1", email: "tenant@example.com" } as never,
        role: "tenant",
        supabase: {} as never,
      }) as Awaited<ReturnType<InitShortletStripeDeps["requireRole"]>>,
    getShortletPaymentsProviderFlags: async () => ({ stripeEnabled: true, paystackEnabled: true }),
    getShortletPaymentCheckoutContext: async () =>
      makeBookingContext({
        status: "pending",
        payment: {
          id: "payment-1",
          booking_id: "11111111-1111-4111-8111-111111111111",
          property_id: "22222222-2222-4222-8222-222222222222",
          guest_user_id: "tenant-1",
          host_user_id: "host-1",
          provider: "stripe",
          currency: "NGN",
          amount_total_minor: 120000,
          status: "succeeded",
          provider_reference: "cs_123",
          provider_payload_json: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    getProviderModes: async () => ({ stripeMode: "test", paystackMode: "test", flutterwaveMode: "test" }),
    getStripeConfigForMode: () => ({ mode: "test", secretKey: "sk_test", webhookSecret: "wh_test" }),
    getStripeClient: () =>
      ({
        checkout: {
          sessions: {
            create: async () => ({ id: "cs_1", url: "https://stripe.example/checkout" }),
          },
        },
      }) as never,
    getSiteUrl: async () => "https://example.com",
    upsertShortletPaymentIntent: async () => {
      upsertCalled = true;
      return {
        payment: makeBookingContext().payment as never,
        alreadySucceeded: false,
      };
    },
  };

  const response = await postInitShortletStripeResponse(
    makeRequest("http://localhost/api/shortlet/payments/stripe/init", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    }),
    deps
  );

  assert.equal(response.status, 409);
  assert.equal(upsertCalled, false);
});

void test("provider toggles disable init endpoints", async () => {
  const authOk = async () =>
    ({
      ok: true,
      user: { id: "tenant-1", email: "tenant@example.com" } as never,
      role: "tenant",
      supabase: {} as never,
    }) as Awaited<ReturnType<InitShortletPaystackDeps["requireRole"]>>;

  const paystackResponse = await postInitShortletPaystackResponse(
    makeRequest("http://localhost/api/shortlet/payments/paystack/init", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    }),
    {
      hasServiceRoleEnv: () => true,
      hasPaystackServerEnv: () => true,
      requireRole: authOk,
      getShortletPaymentsProviderFlags: async () => ({ stripeEnabled: true, paystackEnabled: false }),
      getShortletPaymentCheckoutContext: async () => makeBookingContext(),
      getSiteUrl: async () => "https://example.com",
      getPaystackServerConfig: () => ({ secretKey: "sk_test", publicKey: "pk_test", webhookSecret: "wh_test" }),
      initializeTransaction: async () => ({
        authorizationUrl: "https://paystack.example/checkout",
        accessCode: "ac_1",
        reference: "ps_ref_1",
      }),
      upsertShortletPaymentIntent: async () => ({ payment: makeBookingContext().payment as never, alreadySucceeded: false }),
    }
  );

  assert.equal(paystackResponse.status, 409);

  const stripeResponse = await postInitShortletStripeResponse(
    makeRequest("http://localhost/api/shortlet/payments/stripe/init", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    }),
    {
      hasServiceRoleEnv: () => true,
      requireRole: authOk,
      getShortletPaymentsProviderFlags: async () => ({ stripeEnabled: false, paystackEnabled: true }),
      getShortletPaymentCheckoutContext: async () => makeBookingContext(),
      getProviderModes: async () => ({ stripeMode: "test", paystackMode: "test", flutterwaveMode: "test" }),
      getStripeConfigForMode: () => ({ mode: "test", secretKey: "sk_test", webhookSecret: "wh_test" }),
      getStripeClient: () =>
        ({
          checkout: {
            sessions: {
              create: async () => ({ id: "cs_1", url: "https://stripe.example/checkout" }),
            },
          },
        }) as never,
      getSiteUrl: async () => "https://example.com",
      upsertShortletPaymentIntent: async () => ({ payment: makeBookingContext().payment as never, alreadySucceeded: false }),
    }
  );

  assert.equal(stripeResponse.status, 409);
});

void test("stripe init preserves auth failure response", async () => {
  const deps: InitShortletStripeDeps = {
    hasServiceRoleEnv: () => true,
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<InitShortletStripeDeps["requireRole"]>>,
    getShortletPaymentsProviderFlags: async () => ({ stripeEnabled: true, paystackEnabled: true }),
    getShortletPaymentCheckoutContext: async () => makeBookingContext(),
    getProviderModes: async () => ({ stripeMode: "test", paystackMode: "test", flutterwaveMode: "test" }),
    getStripeConfigForMode: () => ({ mode: "test", secretKey: "sk_test", webhookSecret: "wh_test" }),
    getStripeClient: () =>
      ({
        checkout: {
          sessions: {
            create: async () => ({ id: "cs_1", url: "https://stripe.example/checkout" }),
          },
        },
      }) as never,
    getSiteUrl: async () => "https://example.com",
    upsertShortletPaymentIntent: async () => ({ payment: makeBookingContext().payment as never, alreadySucceeded: false }),
  };

  const response = await postInitShortletStripeResponse(
    makeRequest("http://localhost/api/shortlet/payments/stripe/init", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    }),
    deps
  );

  assert.equal(response.status, 401);
});
