import test from "node:test";
import assert from "node:assert/strict";

import { buildMessagingAdminSnapshot } from "../../lib/admin/messaging-observability";

void test("messaging observability flags restricted cases", () => {
  const snapshot = buildMessagingAdminSnapshot({
    messages: [
      {
        id: "m1",
        property_id: "p1",
        sender_id: "tenant-1",
        recipient_id: "host-1",
        body: "Hello",
        created_at: "2026-01-04T10:00:00.000Z",
      },
      {
        id: "m2",
        property_id: "p1",
        sender_id: "host-1",
        recipient_id: "tenant-1",
        body: "Hi",
        created_at: "2026-01-04T10:05:00.000Z",
      },
      {
        id: "m3",
        property_id: "p1",
        sender_id: "host-1",
        recipient_id: "tenant-2",
        body: "Hello tenant",
        created_at: "2026-01-04T11:00:00.000Z",
      },
      {
        id: "m4",
        property_id: "p1",
        sender_id: "agent-2",
        recipient_id: "agent-3",
        body: "Off thread",
        created_at: "2026-01-04T12:00:00.000Z",
      },
    ],
    profiles: [
      { id: "tenant-1", role: "tenant" },
      { id: "tenant-2", role: "tenant" },
      { id: "host-1", role: "landlord" },
      { id: "agent-2", role: "agent" },
      { id: "agent-3", role: "agent" },
    ],
    properties: [
      { id: "p1", owner_id: "host-1", is_approved: true, is_active: true },
    ],
  });

  assert.equal(snapshot.totalMessages, 4);
  assert.equal(snapshot.statusCounts.delivered, 4);
  assert.equal(snapshot.restricted.length, 2);
  const reasons = snapshot.restricted.map((item) => item.reason).sort();
  assert.deepEqual(reasons, ["owner_cannot_start", "owner_mismatch"]);
});
