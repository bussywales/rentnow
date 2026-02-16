import test from "node:test";
import assert from "node:assert/strict";
import {
  dispatchShortletNotificationEvent,
  type ShortletNotificationDispatchDeps,
} from "@/lib/shortlet/notifications.server";

function buildFakeNotificationClient() {
  const reserved = new Set<string>();
  const updates: Array<{
    row: Record<string, unknown>;
    bookingId: string;
    eventType: string;
    recipientUserId: string;
  }> = [];

  const client = {
    from: () => ({
      insert: async (row: {
        booking_id: string;
        event_type: string;
        recipient_user_id: string;
      }) => {
        const key = `${row.booking_id}:${row.event_type}:${row.recipient_user_id}`;
        if (reserved.has(key)) {
          return {
            error: {
              code: "23505",
              message: "duplicate key value violates unique constraint",
            },
          };
        }
        reserved.add(key);
        return { error: null };
      },
      update: (row: Record<string, unknown>) => ({
        eq: (_column1: string, bookingId: string) => ({
          eq: (_column2: string, eventType: string) => ({
            eq: async (_column3: string, recipientUserId: string) => {
              updates.push({ row, bookingId, eventType, recipientUserId });
              return { error: null };
            },
          }),
        }),
      }),
    }),
  };

  return { client, updates };
}

void test("shortlet notification dispatch sends each booking event email once", async () => {
  const fake = buildFakeNotificationClient();
  const sentEmails: Array<{ to: string; subject: string }> = [];

  const deps: ShortletNotificationDispatchDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => fake.client as never,
    sendEmail: async (to, subject) => {
      sentEmails.push({ to, subject });
      return { ok: true };
    },
  };

  const payload = {
    propertyTitle: "Lekki shortlet",
    city: "Lagos",
    checkIn: "2026-03-14",
    checkOut: "2026-03-17",
    nights: 3,
    amountMinor: 180000,
    currency: "NGN",
    bookingId: "booking-123",
  };

  await dispatchShortletNotificationEvent(
    {
      eventType: "tenant_booking_request_sent",
      recipientUserId: "tenant-123",
      recipientEmail: "tenant@example.com",
      payload,
    },
    deps
  );

  await dispatchShortletNotificationEvent(
    {
      eventType: "tenant_booking_request_sent",
      recipientUserId: "tenant-123",
      recipientEmail: "tenant@example.com",
      payload,
    },
    deps
  );

  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0]?.subject, "Your booking request was sent");
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0]?.row.status, "sent");
});

void test("shortlet notification dispatch skips when service role env is unavailable", async () => {
  const fake = buildFakeNotificationClient();
  let sendCalls = 0;

  const deps: ShortletNotificationDispatchDeps = {
    hasServiceRoleEnv: () => false,
    createServiceRoleClient: () => fake.client as never,
    sendEmail: async () => {
      sendCalls += 1;
      return { ok: true };
    },
  };

  await dispatchShortletNotificationEvent(
    {
      eventType: "host_new_booking_request",
      recipientUserId: "host-123",
      recipientEmail: "host@example.com",
      payload: {
        propertyTitle: "Lekki shortlet",
        city: "Lagos",
        checkIn: "2026-03-14",
        checkOut: "2026-03-17",
        nights: 3,
        amountMinor: 180000,
        currency: "NGN",
        bookingId: "booking-123",
      },
    },
    deps
  );

  assert.equal(sendCalls, 0);
});
