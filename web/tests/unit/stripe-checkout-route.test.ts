import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@supabase/supabase-js";

import {
  postStripeCheckoutResponse,
  type StripeCheckoutRouteDeps,
} from "@/app/api/billing/stripe/checkout/route";

const makeRequest = () =>
  new Request("http://localhost/api/billing/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier: "starter", cadence: "monthly" }),
  });

void test("stripe checkout route sanitizes schema mismatch failures", async () => {
  const logs: unknown[] = [];
  const authSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: {
              message:
                'Could not find the "stripe_customer_id" column of "profile_plans" in the schema cache',
            },
          }),
        }),
      }),
    }),
  };

  const deps: StripeCheckoutRouteDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "agent",
        user: { id: "user-1", email: "agent@example.com" } as User,
        supabase: authSupabase,
      }) as Awaited<ReturnType<StripeCheckoutRouteDeps["requireRole"]>>,
    getProviderModes: async () => ({ stripeMode: "test" }),
    getStripeConfigForMode: () => ({ mode: "test", secretKey: "sk_test", webhookSecret: null }),
    getMarketSettings: async () => ({}),
    resolveMarketFromRequest: () => ({ country: "NG", currency: "NGN", label: "Nigeria" }),
    loadSubscriptionPriceBookRows: async () => [],
    resolveSubscriptionPlanQuote: async () =>
      ({
        status: "ready",
        provider: "stripe",
        priceId: "price_123",
        currency: "NGN",
        amountMinor: 290000,
        resolutionKey: "agent:starter:monthly:NG",
      }) as Awaited<ReturnType<StripeCheckoutRouteDeps["resolveSubscriptionPlanQuote"]>>,
    getSiteUrl: async () => "https://example.com",
    getStripeClient: () =>
      ({
        checkout: {
          sessions: {
            create: async () => ({ url: "https://checkout.stripe.com/test" }),
          },
        },
      }) as never,
    logFailure: ({ error }) => {
      logs.push(error);
    },
    logStripeCheckoutStarted: () => undefined,
    logProductAnalyticsEvent: async () => undefined,
  };

  const response = await postStripeCheckoutResponse(makeRequest(), deps);
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error, "We couldn’t start checkout right now. Try again in a moment.");
  assert.equal(logs.length, 1);
});

void test("stripe checkout route still returns checkout url when dependencies are healthy", async () => {
  const authSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              stripe_customer_id: "cus_123",
              stripe_subscription_id: null,
              stripe_status: null,
              stripe_current_period_end: null,
            },
            error: null,
          }),
        }),
      }),
    }),
  };

  const deps: StripeCheckoutRouteDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "agent",
        user: { id: "user-1", email: "agent@example.com" } as User,
        supabase: authSupabase,
      }) as Awaited<ReturnType<StripeCheckoutRouteDeps["requireRole"]>>,
    getProviderModes: async () => ({ stripeMode: "test" }),
    getStripeConfigForMode: () => ({ mode: "test", secretKey: "sk_test", webhookSecret: null }),
    getMarketSettings: async () => ({}),
    resolveMarketFromRequest: () => ({ country: "NG", currency: "NGN", label: "Nigeria" }),
    loadSubscriptionPriceBookRows: async () => [],
    resolveSubscriptionPlanQuote: async () =>
      ({
        status: "ready",
        provider: "stripe",
        priceId: "price_123",
        currency: "NGN",
        amountMinor: 290000,
        resolutionKey: "agent:starter:monthly:NG",
      }) as Awaited<ReturnType<StripeCheckoutRouteDeps["resolveSubscriptionPlanQuote"]>>,
    getSiteUrl: async () => "https://example.com",
    getStripeClient: () =>
      ({
        checkout: {
          sessions: {
            create: async () => ({ url: "https://checkout.stripe.com/test" }),
          },
        },
      }) as never,
    logFailure: () => undefined,
    logStripeCheckoutStarted: () => undefined,
    logProductAnalyticsEvent: async () => undefined,
  };

  const response = await postStripeCheckoutResponse(makeRequest(), deps);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.url, "https://checkout.stripe.com/test");
});
