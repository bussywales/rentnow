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
    upsertShortletPaymentIntent: async (input) => {
      void input;
      return {
        payment: makeBookingContext().payment as never,
        alreadySucceeded: false,
      };
    },
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
    upsertShortletPaymentIntent: async (input) => {
      void input;
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
      upsertShortletPaymentIntent: async (input) => {
        void input;
        return { payment: makeBookingContext().payment as never, alreadySucceeded: false };
      },
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
      upsertShortletPaymentIntent: async (input) => {
        void input;
        return { payment: makeBookingContext().payment as never, alreadySucceeded: false };
      },
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
    upsertShortletPaymentIntent: async (input) => {
      void input;
      return { payment: makeBookingContext().payment as never, alreadySucceeded: false };
    },
  };

  const response = await postInitShortletStripeResponse(
    makeRequest("http://localhost/api/shortlet/payments/stripe/init", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    }),
    deps
  );

  assert.equal(response.status, 401);
});

void test("stripe init returns provider unavailable when NGN booking prefers paystack", async () => {
  let stripeCreateCalled = false;
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
    getShortletPaymentCheckoutContext: async () => makeBookingContext(),
    getProviderModes: async () => ({ stripeMode: "test", paystackMode: "test", flutterwaveMode: "test" }),
    getStripeConfigForMode: () => ({ mode: "test", secretKey: "sk_test", webhookSecret: "wh_test" }),
    getStripeClient: () =>
      ({
        checkout: {
          sessions: {
            create: async () => {
              stripeCreateCalled = true;
              return { id: "cs_1", url: "https://stripe.example/checkout" };
            },
          },
        },
      }) as never,
    getSiteUrl: async () => "https://example.com",
    upsertShortletPaymentIntent: async (input) => {
      void input;
      return { payment: makeBookingContext().payment as never, alreadySucceeded: false };
    },
  };

  const response = await postInitShortletStripeResponse(
    makeRequest("http://localhost/api/shortlet/payments/stripe/init", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    }),
    deps
  );

  const payload = (await response.json()) as { error?: string; reason?: string };
  assert.equal(response.status, 409);
  assert.equal(payload.error, "SHORTLET_PAYMENT_PROVIDER_UNAVAILABLE");
  assert.equal(payload.reason, "provider_paystack_preferred_for_currency");
  assert.equal(stripeCreateCalled, false);
});

void test("stripe init allows NGN booking when paystack is disabled and stripe is enabled", async () => {
  const deps: InitShortletStripeDeps = {
    hasServiceRoleEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "tenant-1", email: "tenant@example.com" } as never,
        role: "tenant",
        supabase: {} as never,
      }) as Awaited<ReturnType<InitShortletStripeDeps["requireRole"]>>,
    getShortletPaymentsProviderFlags: async () => ({ stripeEnabled: true, paystackEnabled: false }),
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
    upsertShortletPaymentIntent: async (input) => {
      void input;
      return { payment: makeBookingContext().payment as never, alreadySucceeded: false };
    },
  };

  const response = await postInitShortletStripeResponse(
    makeRequest("http://localhost/api/shortlet/payments/stripe/init", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    }),
    deps
  );

  const payload = (await response.json()) as { provider?: string; checkout_url?: string };
  assert.equal(response.status, 200);
  assert.equal(payload.provider, "stripe");
  assert.equal(payload.checkout_url, "https://stripe.example/checkout");
});

void test("paystack init returns SHORTLET_INVALID_AMOUNT for non-positive computed amount", async () => {
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
    getShortletPaymentCheckoutContext: async () => makeBookingContext({ totalAmountMinor: 0 }),
    getSiteUrl: async () => "https://example.com",
    getPaystackServerConfig: () => ({ secretKey: "sk_test", publicKey: "pk_test", webhookSecret: "wh_test" }),
    initializeTransaction: async () => ({
      authorizationUrl: "https://paystack.example/checkout",
      accessCode: "ac_1",
      reference: "ps_ref_1",
    }),
    upsertShortletPaymentIntent: async (input) => {
      void input;
      return { payment: makeBookingContext().payment as never, alreadySucceeded: false };
    },
  };

  const response = await postInitShortletPaystackResponse(
    makeRequest("http://localhost/api/shortlet/payments/paystack/init", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    }),
    deps
  );
  const payload = (await response.json()) as { code?: string };

  assert.equal(response.status, 400);
  assert.equal(payload.code, "SHORTLET_INVALID_AMOUNT");
});

void test("payment init routes pass computed amountMinor into shortlet payment upsert", async () => {
  let paystackAmountMinor: number | null = null;
  let stripeAmountMinor: number | null = null;

  const paystackDeps: InitShortletPaystackDeps = {
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
    getShortletPaymentCheckoutContext: async () => makeBookingContext({ countryCode: "NG", currency: "NGN" }),
    getSiteUrl: async () => "https://example.com",
    getPaystackServerConfig: () => ({ secretKey: "sk_test", publicKey: "pk_test", webhookSecret: "wh_test" }),
    initializeTransaction: async () => ({
      authorizationUrl: "https://paystack.example/checkout",
      accessCode: "ac_1",
      reference: "ps_ref_1",
    }),
    upsertShortletPaymentIntent: async (input) => {
      paystackAmountMinor = input.amountMinor;
      return { payment: makeBookingContext().payment as never, alreadySucceeded: false };
    },
  };

  const paystackResponse = await postInitShortletPaystackResponse(
    makeRequest("http://localhost/api/shortlet/payments/paystack/init", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    }),
    paystackDeps
  );
  assert.equal(paystackResponse.status, 200);

  const stripeDeps: InitShortletStripeDeps = {
    hasServiceRoleEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "tenant-1", email: "tenant@example.com" } as never,
        role: "tenant",
        supabase: {} as never,
      }) as Awaited<ReturnType<InitShortletStripeDeps["requireRole"]>>,
    getShortletPaymentsProviderFlags: async () => ({ stripeEnabled: true, paystackEnabled: false }),
    getShortletPaymentCheckoutContext: async () => makeBookingContext({ countryCode: "US", currency: "USD" }),
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
    upsertShortletPaymentIntent: async (input) => {
      stripeAmountMinor = input.amountMinor;
      return { payment: makeBookingContext().payment as never, alreadySucceeded: false };
    },
  };

  const stripeResponse = await postInitShortletStripeResponse(
    makeRequest("http://localhost/api/shortlet/payments/stripe/init", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    }),
    stripeDeps
  );
  assert.equal(stripeResponse.status, 200);

  assert.equal(paystackAmountMinor, 120000);
  assert.equal(stripeAmountMinor, 120000);
});
