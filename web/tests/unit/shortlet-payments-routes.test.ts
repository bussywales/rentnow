import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  postShortletPaymentInitResponse,
  type InitShortletPaymentDeps,
} from "@/app/api/shortlet/payments/init/route";
import {
  postShortletPaymentVerifyResponse,
  type VerifyShortletPaymentDeps,
} from "@/app/api/shortlet/payments/verify/route";

function makeInitRequest(payload: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/shortlet/payments/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function makeVerifyRequest(payload: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/shortlet/payments/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

void test("shortlet payment init returns 400 when session email is missing", async () => {
  const deps: InitShortletPaymentDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    hasPaystackServerEnv: () => true,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "tenant-1", email: null } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<InitShortletPaymentDeps["requireUser"]>>,
    getUserRole: async () => "tenant",
    createServiceRoleClient: () => ({}) as never,
    buildShortletPaymentReference: () => "RN-SLT-BOOKING-1-ABC123",
    initializeTransaction: async () => ({
      authorizationUrl: "https://example.test/pay",
      accessCode: "access_code_1",
      reference: "RN-SLT-BOOKING-1-ABC123",
    }),
    getPaystackServerConfig: () => ({ secretKey: "sk_test", publicKey: "pk_test", webhookSecret: "wh" }),
    getSiteUrl: async () => "https://www.propatyhub.com",
  };

  const response = await postShortletPaymentInitResponse(
    makeInitRequest({ bookingId: "11111111-1111-4111-8111-111111111111" }),
    deps
  );
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(String(body.error || ""), /Account email is required/i);
});

void test("shortlet payment init reuses initiated payment idempotently", async () => {
  const adminClient = {
    from: (table: string) => {
      if (table === "shortlet_bookings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "11111111-1111-4111-8111-111111111111",
                  guest_user_id: "tenant-1",
                  status: "pending",
                  total_amount_minor: 550000,
                  total_price_minor: 550000,
                  currency: "NGN",
                  payment_reference: "RN-SLT-BOOK1-ABC",
                  property_id: "22222222-2222-4222-8222-222222222222",
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ data: null, error: null }),
          }),
        };
      }
      if (table === "shortlet_payments") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "pay-1",
                  status: "initiated",
                  reference: "RN-SLT-BOOK1-ABC",
                  access_code: "ac-inline-1",
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

  const deps: InitShortletPaymentDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    hasPaystackServerEnv: () => true,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "tenant-1", email: "tenant@example.com" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<InitShortletPaymentDeps["requireUser"]>>,
    getUserRole: async () => "tenant",
    createServiceRoleClient: () => adminClient as never,
    buildShortletPaymentReference: () => "RN-SLT-BOOK1-NEW",
    initializeTransaction: async () => {
      throw new Error("should_not_be_called_when_reusing_payment");
    },
    getPaystackServerConfig: () => ({ secretKey: "sk_test", publicKey: "pk_test", webhookSecret: "wh" }),
    getSiteUrl: async () => "https://www.propatyhub.com",
  };

  const response = await postShortletPaymentInitResponse(
    makeInitRequest({ bookingId: "11111111-1111-4111-8111-111111111111" }),
    deps
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.reused, true);
  assert.equal(body.reference, "RN-SLT-BOOK1-ABC");
  assert.equal(body.access_code, "ac-inline-1");
});

void test("shortlet payment verify stores authorization and customer codes", async () => {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const adminClient = {
    from: (table: string) => {
      if (table === "shortlet_payments") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "payment-1",
                  booking_id: "booking-1",
                  status: "initiated",
                  currency: "NGN",
                  amount_minor: 300000,
                  reference: "RN-SLT-BKG1-XYZ",
                  shortlet_bookings: {
                    id: "booking-1",
                    guest_user_id: "tenant-1",
                    status: "pending",
                  },
                },
                error: null,
              }),
            }),
          }),
          update: (values: Record<string, unknown>) => ({
            eq: async () => {
              updates.push({ table, values });
              return { data: null, error: null };
            },
          }),
        };
      }
      if (table === "shortlet_bookings") {
        return {
          update: (values: Record<string, unknown>) => ({
            eq: async () => {
              updates.push({ table, values });
              return { data: null, error: null };
            },
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const deps: VerifyShortletPaymentDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    hasPaystackServerEnv: () => true,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "tenant-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<VerifyShortletPaymentDeps["requireUser"]>>,
    getUserRole: async () => "tenant",
    createServiceRoleClient: () => adminClient as never,
    verifyTransaction: async () => ({
      ok: true,
      status: "success",
      amountMinor: 300000,
      currency: "NGN",
      paidAt: "2026-02-15T10:00:00.000Z",
      authorizationCode: "AUTH-CODE-1",
      customerCode: "CUS-CODE-1",
      email: "tenant@example.com",
      raw: { data: { status: "success" } },
    }),
    getPaystackServerConfig: () => ({ secretKey: "sk_test", publicKey: "pk_test", webhookSecret: "wh" }),
  };

  const response = await postShortletPaymentVerifyResponse(
    makeVerifyRequest({ reference: "RN-SLT-BKG1-XYZ" }),
    deps
  );
  assert.equal(response.status, 200);

  const paymentUpdate = updates.find((entry) => entry.table === "shortlet_payments");
  assert.ok(paymentUpdate);
  assert.equal(paymentUpdate?.values.status, "authorised");
  assert.equal(paymentUpdate?.values.authorization_code, "AUTH-CODE-1");
  assert.equal(paymentUpdate?.values.customer_code, "CUS-CODE-1");
});
