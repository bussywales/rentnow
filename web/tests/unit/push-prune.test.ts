import test from "node:test";
import assert from "node:assert/strict";

import { deliverPushNotifications } from "../../lib/alerts/tenant-alerts";

void test("deliverPushNotifications prunes stale endpoints and marks prune on success", async () => {
  const deleted: string[] = [];
  const adminDb = {
    from: (table: string) => {
      assert.equal(table, "push_subscriptions");
      const query = {
        delete: () => query,
        eq: (column: string, value: string) => {
          assert.equal(column, "profile_id");
          assert.equal(value, "user-1");
          return query;
        },
        in: (column: string, endpoints: string[]) => {
          assert.equal(column, "endpoint");
          deleted.push(...endpoints);
          return Promise.resolve({ error: null });
        },
      };
      return query;
    },
  };

  const outcome = await deliverPushNotifications({
    adminDb: adminDb as never,
    userId: "user-1",
    subscriptions: [
      { endpoint: "https://push.example/stale", p256dh: "k1", auth: "a1" },
      { endpoint: "https://push.example/ok", p256dh: "k2", auth: "a2" },
    ],
    payload: { title: "Test" },
    sendPush: async ({ subscription }) => {
      if (subscription.endpoint.includes("stale")) {
        return { ok: false, statusCode: 410, error: "gone" };
      }
      return { ok: true };
    },
  });

  assert.equal(outcome.status, "sent");
  assert.equal(outcome.error, "push_pruned:gone");
  assert.deepEqual(deleted, ["https://push.example/stale"]);
});

void test("deliverPushNotifications marks prune alongside failure", async () => {
  const adminDb = {
    from: () => {
      const query = {
        delete: () => query,
        eq: () => query,
        in: () => Promise.resolve({ error: null }),
      };
      return query;
    },
  };

  const outcome = await deliverPushNotifications({
    adminDb: adminDb as never,
    userId: "user-2",
    subscriptions: [{ endpoint: "https://push.example/stale", p256dh: "k1", auth: "a1" }],
    payload: { title: "Test" },
    sendPush: async () => ({ ok: false, statusCode: 410, error: "gone" }),
  });

  assert.equal(outcome.status, "failed");
  assert.equal(outcome.error, "push_failed:gone | push_pruned:gone");
});
