import test from "node:test";
import assert from "node:assert/strict";
import {
  createInAppNotification,
  type CreateInAppNotificationDeps,
} from "@/lib/notifications/in-app.server";

function buildFakeClient() {
  const dedupeKeys = new Set<string>();

  return {
    from: () => ({
      insert: async (row: { dedupe_key: string }) => {
        if (dedupeKeys.has(row.dedupe_key)) {
          return {
            error: {
              code: "23505",
              message: "duplicate key value violates unique constraint",
            },
          };
        }
        dedupeKeys.add(row.dedupe_key);
        return { error: null };
      },
    }),
  };
}

void test("in-app notifications are idempotent by dedupe key", async () => {
  const fakeClient = buildFakeClient();
  const deps: CreateInAppNotificationDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => fakeClient as never,
  };

  const first = await createInAppNotification(
    {
      userId: "tenant-1",
      type: "shortlet_booking_request_sent",
      title: "Your booking request was sent",
      body: "2026-02-20 to 2026-02-22 · 2 nights · NGN 120,000.00",
      href: "/trips/booking-1",
      dedupeKey: "shortlet_booking:booking-1:request_sent:tenant",
    },
    deps
  );

  const second = await createInAppNotification(
    {
      userId: "tenant-1",
      type: "shortlet_booking_request_sent",
      title: "Your booking request was sent",
      body: "2026-02-20 to 2026-02-22 · 2 nights · NGN 120,000.00",
      href: "/trips/booking-1",
      dedupeKey: "shortlet_booking:booking-1:request_sent:tenant",
    },
    deps
  );

  assert.equal(first.inserted, true);
  assert.equal(first.duplicate, false);
  assert.equal(second.inserted, false);
  assert.equal(second.duplicate, true);
});
