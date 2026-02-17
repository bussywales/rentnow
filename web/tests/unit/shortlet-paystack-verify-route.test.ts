import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { getShortletPaystackVerifyResponse } from "@/app/api/shortlet/payments/paystack/verify/route";
import type { ShortletPaymentBookingContext } from "@/lib/shortlet/payments.server";

void test("paystack verify endpoint confirms shortlet payment and transitions booking", async () => {
  let upsertCalled = false;
  let transitionCalled = false;
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

  const response = await getShortletPaystackVerifyResponse(
    new NextRequest(
      "http://localhost/api/shortlet/payments/paystack/verify?reference=shb_ps_11111111-1111-4111-8111-111111111111_123&booking_id=11111111-1111-4111-8111-111111111111"
    ),
    {
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => ({} as never),
      hasPaystackServerEnv: () => true,
      requireRole: async () =>
        ({
          ok: true,
          user: { id: "tenant_1", email: "tenant@example.com" } as never,
          role: "tenant",
          supabase: {} as never,
        }) as never,
      getPaystackServerConfig: () => ({ secretKey: "sk_test", publicKey: "pk_test", webhookSecret: "wh_test" }),
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
      dispatchShortletPaymentSuccess: async () => undefined,
    }
  );

  const payload = (await response.json()) as { ok?: boolean; booking_status?: string };
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.booking_status, "pending");
  assert.equal(upsertCalled, true);
  assert.equal(transitionCalled, true);
});
