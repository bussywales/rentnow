import test from "node:test";
import assert from "node:assert/strict";
import { buildThreadParticipantFilter, computeUnreadCount } from "@/lib/messaging/threads";
import type { Message } from "@/lib/types";

void test("thread participant filter respects role", () => {
  const filter = buildThreadParticipantFilter("tenant", "user-1");
  assert.equal(filter, "tenant_id.eq.user-1,host_id.eq.user-1");

  const hostFilter = buildThreadParticipantFilter("landlord", "host-1");
  assert.equal(hostFilter, "tenant_id.eq.host-1,host_id.eq.host-1");

  const adminFilter = buildThreadParticipantFilter("admin", "admin-1");
  assert.equal(adminFilter, null);
});

void test("computeUnreadCount respects last_read_at and sender", () => {
  const base = new Date("2026-01-30T00:00:00Z");
  const messages: Message[] = [
    { id: "m1", property_id: "p1", sender_id: "host", recipient_id: "tenant", body: "Hello", created_at: base.toISOString() },
    { id: "m2", property_id: "p1", sender_id: "tenant", recipient_id: "host", body: "Reply", created_at: new Date(base.getTime() + 1000).toISOString() },
    { id: "m3", property_id: "p1", sender_id: "host", recipient_id: "tenant", body: "Follow up", created_at: new Date(base.getTime() + 2000).toISOString() },
  ];

  assert.equal(computeUnreadCount(messages, "tenant", null), 2);
  assert.equal(
    computeUnreadCount(messages, "tenant", new Date(base.getTime() + 1500).toISOString()),
    1
  );
  assert.equal(
    computeUnreadCount(messages, "tenant", new Date(base.getTime() + 3000).toISOString()),
    0
  );
});
