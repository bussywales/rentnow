import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMessagingAdminSnapshot,
  filterMessagingAdminMessages,
} from "../../lib/admin/messaging-observability";

void test("messaging observability flags restricted cases", () => {
  const snapshot = buildMessagingAdminSnapshot({
    messages: [
      {
        id: "m1",
        property_id: "p1",
        sender_id: "tenant-1",
        recipient_id: "host-1",
        created_at: "2026-01-04T10:00:00.000Z",
      },
      {
        id: "m2",
        property_id: "p1",
        sender_id: "host-1",
        recipient_id: "tenant-1",
        created_at: "2026-01-04T10:05:00.000Z",
      },
      {
        id: "m3",
        property_id: "p1",
        sender_id: "host-1",
        recipient_id: "tenant-2",
        created_at: "2026-01-04T11:00:00.000Z",
      },
      {
        id: "m4",
        property_id: "p1",
        sender_id: "agent-2",
        recipient_id: "agent-3",
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
      {
        id: "p1",
        owner_id: "host-1",
        status: "live",
        is_approved: true,
        is_active: true,
        expires_at: null,
      },
    ],
  });

  assert.equal(snapshot.totalMessages, 4);
  assert.equal(snapshot.statusCounts.delivered, 4);
  assert.equal(snapshot.restricted.length, 2);
  const reasons = snapshot.restricted.map((item) => item.reason).sort();
  assert.deepEqual(reasons, ["conversation_not_allowed", "conversation_not_allowed"]);
  assert.ok(snapshot.restricted.every((item) => item.reasonLabel.length > 0));
  assert.ok(snapshot.recentMessages.some((item) => item.status === "restricted"));
});

void test("messaging admin filters handle optional fields", () => {
  const messages = [
    {
      id: "m1",
      propertyId: "p1",
      senderId: "s1",
      recipientId: "r1",
      senderRole: null,
      recipientRole: null,
      status: "restricted" as const,
      reasonCode: undefined,
      reasonLabel: undefined,
      createdAt: null,
    },
    {
      id: "m2",
      propertyId: "p2",
      senderId: "s2",
      recipientId: "r2",
      senderRole: "tenant" as const,
      recipientRole: "landlord" as const,
      status: "delivered" as const,
      createdAt: null,
    },
  ];

  const filtered = filterMessagingAdminMessages(messages, "restricted", "conversation_not_allowed");
  assert.equal(filtered.length, 0);
});

void test("messaging admin filters match rate-limited cases", () => {
  const messages = [
    {
      id: "m1",
      propertyId: "p1",
      senderId: "s1",
      recipientId: "r1",
      senderRole: null,
      recipientRole: null,
      status: "restricted" as const,
      reasonCode: "rate_limited" as const,
      reasonLabel: "Too many messages.",
      createdAt: "2026-01-05T10:00:00.000Z",
    },
    {
      id: "m2",
      propertyId: "p2",
      senderId: "s2",
      recipientId: "r2",
      senderRole: "tenant" as const,
      recipientRole: "landlord" as const,
      status: "delivered" as const,
      createdAt: "2026-01-05T11:00:00.000Z",
    },
  ];

  const filtered = filterMessagingAdminMessages(messages, "restricted", "rate_limited");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, "m1");
});
