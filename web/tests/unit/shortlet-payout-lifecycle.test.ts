import test from "node:test";
import assert from "node:assert/strict";
import { buildHostEarningsTimeline } from "@/lib/shortlet/host-earnings";
import { markShortletPayoutPaid } from "@/lib/shortlet/shortlet.server";

type MockPayoutRow = {
  id: string;
  status: "eligible" | "paid";
  booking_id: string;
  paid_at: string | null;
  paid_method: string | null;
  paid_reference: string | null;
  paid_by: string | null;
  note: string | null;
};

function createMockClient(initial: MockPayoutRow) {
  let payout = { ...initial };
  const audits: Array<Record<string, unknown>> = [];

  const client = {
    from(table: string) {
      if (table === "shortlet_payouts") {
        return {
          select() {
            let idFilter: string | null = null;
            return {
              eq(column: string, value: unknown) {
                if (column === "id") idFilter = String(value || "");
                return this;
              },
              async maybeSingle() {
                if (!idFilter || idFilter !== payout.id) {
                  return { data: null, error: null };
                }
                return { data: { ...payout }, error: null };
              },
            };
          },
          update(payload: Record<string, unknown>) {
            let idFilter: string | null = null;
            let statusFilter: string | null = null;
            return {
              eq(column: string, value: unknown) {
                if (column === "id") idFilter = String(value || "");
                if (column === "status") statusFilter = String(value || "");
                return this;
              },
              select() {
                return {
                  async maybeSingle() {
                    if (!idFilter || idFilter !== payout.id || payout.status !== statusFilter) {
                      return { data: null, error: null };
                    }
                    payout = {
                      ...payout,
                      status: payload.status === "paid" ? "paid" : payout.status,
                      paid_at: typeof payload.paid_at === "string" ? payload.paid_at : payout.paid_at,
                      paid_method:
                        typeof payload.paid_method === "string" ? payload.paid_method : payout.paid_method,
                      paid_reference:
                        typeof payload.paid_reference === "string"
                          ? payload.paid_reference
                          : payout.paid_reference,
                      paid_by: typeof payload.paid_by === "string" ? payload.paid_by : payout.paid_by,
                      note: typeof payload.note === "string" ? payload.note : payout.note,
                    };
                    return { data: { ...payout }, error: null };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "shortlet_payout_audit") {
        return {
          async insert(payload: Record<string, unknown>) {
            audits.push(payload);
            return { error: null };
          },
        };
      }

      throw new Error(`Unhandled table ${table}`);
    },
  };

  return {
    client: client as never,
    getPayout: () => ({ ...payout }),
    getAudits: () => [...audits],
  };
}

void test("markShortletPayoutPaid writes audit trail entry", async () => {
  const mock = createMockClient({
    id: "payout-1",
    booking_id: "booking-1",
    status: "eligible",
    paid_at: null,
    paid_method: null,
    paid_reference: null,
    paid_by: null,
    note: null,
  });

  const result = await markShortletPayoutPaid({
    client: mock.client,
    payoutId: "payout-1",
    paidMethod: "bank_transfer",
    paidReference: "TX-001",
    note: "Paid manually",
    paidBy: "admin-1",
  });

  assert.equal(result.alreadyPaid, false);
  assert.equal(mock.getPayout().status, "paid");
  const audits = mock.getAudits();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "mark_paid");
  assert.equal(audits[0].booking_id, "booking-1");
});

void test("host timeline reflects paid payout state after admin mark-paid", () => {
  const timeline = buildHostEarningsTimeline({
    now: new Date("2026-02-22T08:00:00.000Z"),
    bookings: [
      {
        bookingId: "booking-1",
        propertyId: "property-1",
        title: "Island stay",
        city: "Lagos",
        checkIn: "2026-02-15",
        checkOut: "2026-02-18",
        nights: 3,
        bookingStatus: "completed",
        totalMinor: 90_000_00,
        currency: "NGN",
        pricingSnapshot: {},
      },
    ],
    payments: [{ bookingId: "booking-1", status: "succeeded" }],
    payouts: [
      {
        bookingId: "booking-1",
        amountMinor: 90_000_00,
        status: "paid",
        paidAt: "2026-02-20T12:00:00.000Z",
        paidMethod: "bank_transfer",
        paidReference: "TX-001",
        requestedAt: "2026-02-19T09:00:00.000Z",
        requestedByUserId: "host-1",
        requestedMethod: "bank_transfer",
        requestedNote: "Please settle",
      },
    ],
  });

  assert.equal(timeline.items[0]?.payoutStatus, "paid");
  assert.equal(timeline.summary.paidCount, 1);
  assert.equal(timeline.summary.completedUnpaidCount, 0);
});
