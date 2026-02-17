import test from "node:test";
import assert from "node:assert/strict";
import { markShortletPaymentSucceededAndConfirmBooking } from "@/lib/shortlet/payments.server";

type MutableRecord = Record<string, unknown>;

function createMockClient() {
  let paymentRow: MutableRecord = {
    id: "pay_1",
    booking_id: "11111111-1111-4111-8111-111111111111",
    property_id: "22222222-2222-4222-8222-222222222222",
    guest_user_id: "guest_1",
    host_user_id: "host_1",
    provider: "paystack",
    currency: "NGN",
    amount_total_minor: 120000,
    status: "initiated",
    provider_reference: "shb_ps_11111111-1111-4111-8111-111111111111_100",
    provider_payload_json: { seed: true },
    last_verified_at: null,
    verify_attempts: 0,
    needs_reconcile: true,
    reconcile_reason: "booking_status_transition_failed",
    reconcile_locked_until: "2099-01-01T00:00:00.000Z",
    provider_event_id: null,
    provider_tx_id: null,
    confirmed_at: null,
    created_at: "2026-02-17T00:00:00.000Z",
    updated_at: "2026-02-17T00:00:00.000Z",
  };

  const bookingRow: MutableRecord = {
    id: "11111111-1111-4111-8111-111111111111",
    property_id: "22222222-2222-4222-8222-222222222222",
    guest_user_id: "guest_1",
    host_user_id: "host_1",
    status: "confirmed",
    check_in: "2026-03-20",
    check_out: "2026-03-23",
    nights: 3,
    total_amount_minor: 120000,
    currency: "NGN",
    payment_reference: null,
    pricing_snapshot_json: { booking_mode: "request" },
    properties: { title: "Lekki Suite", city: "Lagos", country_code: "NG" },
  };

  return {
    getPaymentRow: () => paymentRow,
    client: {
      from: (table: string) => {
        if (table === "shortlet_payments") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { ...paymentRow }, error: null }),
                }),
              }),
            }),
            update: (values: Record<string, unknown>) => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => {
                    paymentRow = { ...paymentRow, ...values };
                    return { data: { ...paymentRow }, error: null };
                  },
                }),
              }),
            }),
          };
        }

        if (table === "shortlet_bookings") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { ...bookingRow }, error: null }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    },
  };
}

void test("canonical shortlet success helper is idempotent and clears reconcile flags", async () => {
  const mock = createMockClient();

  const first = await markShortletPaymentSucceededAndConfirmBooking({
    provider: "paystack",
    providerReference: "shb_ps_11111111-1111-4111-8111-111111111111_100",
    providerPayload: { gateway_response: "Successful" },
    providerTxId: "tx_1",
    client: mock.client as never,
  });

  assert.equal(first.ok, true);
  assert.equal(first.alreadySucceeded, false);
  const afterFirst = mock.getPaymentRow();
  assert.equal(afterFirst.status, "succeeded");
  assert.equal(afterFirst.needs_reconcile, false);
  assert.equal(afterFirst.reconcile_reason, null);
  assert.equal(afterFirst.reconcile_locked_until, null);
  assert.equal(typeof afterFirst.confirmed_at, "string");
  assert.equal(afterFirst.provider_tx_id, "tx_1");

  const firstConfirmedAt = String(afterFirst.confirmed_at);

  const second = await markShortletPaymentSucceededAndConfirmBooking({
    provider: "paystack",
    providerReference: "shb_ps_11111111-1111-4111-8111-111111111111_100",
    providerPayload: { second_attempt: true },
    providerTxId: "tx_2",
    client: mock.client as never,
  });

  assert.equal(second.ok, true);
  assert.equal(second.alreadySucceeded, true);
  const afterSecond = mock.getPaymentRow();
  assert.equal(afterSecond.status, "succeeded");
  assert.equal(afterSecond.needs_reconcile, false);
  assert.equal(String(afterSecond.confirmed_at), firstConfirmedAt);
  assert.equal(afterSecond.provider_tx_id, "tx_2");
});
