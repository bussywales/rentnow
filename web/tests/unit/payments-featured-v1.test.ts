import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  postInitializeFeaturedPaymentResponse,
  type InitializeFeaturedPaymentDeps,
} from "@/app/api/payments/featured/initialize/route";
import {
  buildFeaturedProductsFromSettings,
  formatMinor,
} from "@/lib/payments/products";
import { validateWebhookSignature } from "@/lib/payments/paystack.server";
import { shouldProcessFeaturedChargeSuccess } from "@/lib/payments/featured-payments.server";
import { sendFeaturedReceiptIfNeeded } from "@/lib/payments/featured-payments-ops.server";

function makeRequest(payload: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/payments/featured/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function makeInitializeDeps(input: {
  role?: "agent" | "landlord" | "admin";
  userId?: string;
  propertyOwnerId?: string;
  requestStatus?: "pending" | "approved" | "rejected" | "cancelled";
  requireRoleResult?: Awaited<ReturnType<InitializeFeaturedPaymentDeps["requireRole"]>>;
}): InitializeFeaturedPaymentDeps {
  const property = {
    id: "11111111-1111-4111-8111-111111111111",
    owner_id: input.propertyOwnerId ?? "owner-1",
    title: "Listing",
    city: "Lagos",
    address: "12 Broad Street",
    status: "live",
    is_active: true,
    is_approved: true,
    expires_at: null,
    is_demo: false,
    is_featured: false,
    featured_until: null,
    description: "A polished listing with complete profile details and enough copy.",
    property_images: [{ id: "img-1" }, { id: "img-2" }, { id: "img-3" }],
  };

  const featuredRequest = {
    id: "22222222-2222-4222-8222-222222222222",
    property_id: property.id,
    requester_user_id: input.userId ?? "owner-1",
    status: input.requestStatus ?? "approved",
    duration_days: 7,
  };

  const client = {
    from: (table: string) => {
      if (table === "properties") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: property, error: null }),
            }),
          }),
        };
      }
      if (table === "featured_requests") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: featuredRequest, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  return {
    hasServiceRoleEnv: () => true,
    hasPaystackServerEnv: () => true,
    requireRole:
      input.requireRoleResult
        ? async () => input.requireRoleResult
        : async () =>
            ({
              ok: true,
              user: {
                id: input.userId ?? "owner-1",
                email: "owner@example.com",
              },
              role: input.role ?? "landlord",
              supabase: {} as never,
            }) as Awaited<ReturnType<InitializeFeaturedPaymentDeps["requireRole"]>>,
    createServiceRoleClient: () =>
      (client as unknown as ReturnType<InitializeFeaturedPaymentDeps["createServiceRoleClient"]>),
    hasActiveDelegation: async () => false,
    getFeaturedEligibilitySettings: async () => ({
      requestsEnabled: true,
      price7dMinor: 1999,
      price30dMinor: 4999,
      currency: "NGN",
      reviewSlaDays: 2,
      requiresApprovedListing: true,
      requiresActiveListing: true,
      requiresNotDemo: true,
      minPhotos: 3,
      minDescriptionChars: 80,
    }),
    getFeaturedProductByPlan: async () => ({
      plan: "featured_7d",
      durationDays: 7,
      amountMinor: 1999,
      currency: "NGN",
    }),
    buildFeaturedPaymentReference: () => "featpay_test_ref",
    createFeaturedPaymentRecords: async () => ({
      payment: {
        id: "33333333-3333-4333-8333-333333333333",
      },
      purchase: {
        id: "44444444-4444-4444-8444-444444444444",
      },
    }),
    markPaymentFailed: async () => undefined,
    initializeTransaction: async () => ({
      authorizationUrl: "https://paystack.test/redirect",
      accessCode: "ac_test",
      reference: "featpay_test_ref",
    }),
    getPaystackServerConfig: () => ({
      secretKey: "sk_test",
      publicKey: "pk_test",
      webhookSecret: "whsec_test",
    }),
    getSiteUrl: async () => "https://www.propatyhub.com",
  };
}

void test("featured payment initialize route returns auth response when unauthorized", async () => {
  const deps = makeInitializeDeps({
    requireRoleResult: {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    },
  });
  const response = await postInitializeFeaturedPaymentResponse(
    makeRequest({
      propertyId: "11111111-1111-4111-8111-111111111111",
      plan: "featured_7d",
      requestId: "22222222-2222-4222-8222-222222222222",
    }),
    deps
  );
  assert.equal(response.status, 401);
});

void test("featured payment initialize route enforces ownership", async () => {
  const deps = makeInitializeDeps({
    userId: "user-2",
    role: "landlord",
    propertyOwnerId: "owner-1",
  });
  const response = await postInitializeFeaturedPaymentResponse(
    makeRequest({
      propertyId: "11111111-1111-4111-8111-111111111111",
      plan: "featured_7d",
      requestId: "22222222-2222-4222-8222-222222222222",
    }),
    deps
  );
  assert.equal(response.status, 403);
});

void test("featured payment initialize route requires an approved request", async () => {
  const deps = makeInitializeDeps({
    userId: "owner-1",
    role: "landlord",
    propertyOwnerId: "owner-1",
    requestStatus: "pending",
  });
  const response = await postInitializeFeaturedPaymentResponse(
    makeRequest({
      propertyId: "11111111-1111-4111-8111-111111111111",
      plan: "featured_7d",
      requestId: "22222222-2222-4222-8222-222222222222",
    }),
    deps
  );
  assert.equal(response.status, 409);
});

void test("featured payment product catalogue builds from settings", () => {
  const products = buildFeaturedProductsFromSettings({
    price7dMinor: 2500,
    price30dMinor: 6000,
    currency: "ngn",
  });
  assert.equal(products.featured_7d.amountMinor, 2500);
  assert.equal(products.featured_30d.amountMinor, 6000);
  assert.equal(products.featured_7d.currency, "NGN");
  assert.match(formatMinor("NGN", 2500), /NGN|₦/);
});

void test("paystack webhook signature validation accepts valid signatures", () => {
  const rawBody = JSON.stringify({ event: "charge.success", data: { reference: "ref_1" } });
  const secret = "whsec_test";
  const signature = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  assert.equal(
    validateWebhookSignature({ rawBody, signature, secret }),
    true
  );
  assert.equal(
    validateWebhookSignature({ rawBody, signature: "bad", secret }),
    false
  );
});

void test("featured charge-success idempotency helper skips already processed payments", () => {
  assert.equal(
    shouldProcessFeaturedChargeSuccess({ paymentStatus: "succeeded", purchaseStatus: "pending" }),
    false
  );
  assert.equal(
    shouldProcessFeaturedChargeSuccess({ paymentStatus: "pending", purchaseStatus: "activated" }),
    false
  );
  assert.equal(
    shouldProcessFeaturedChargeSuccess({ paymentStatus: "pending", purchaseStatus: "pending" }),
    true
  );
});

void test("featured receipt sender is idempotent when receipt was already sent", async () => {
  const originalFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = (async () => {
    fetchCalled = true;
    return new Response(null, { status: 500 });
  }) as typeof fetch;

  const client = {
    from: (table: string) => {
      if (table === "payments") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "pay_1",
                  amount_minor: 4999,
                  currency: "NGN",
                  email: "owner@example.com",
                  reference: "ref_1",
                  receipt_sent_at: "2026-02-12T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  try {
    const result = await sendFeaturedReceiptIfNeeded({
      client: client as never,
      paymentId: "pay_1",
      fallbackEmail: "owner@example.com",
    });
    assert.equal(result.sent, false);
    assert.equal(result.alreadySent, true);
    assert.equal(fetchCalled, false);
  } finally {
    global.fetch = originalFetch;
  }
});
