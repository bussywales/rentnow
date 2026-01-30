import test from "node:test";
import assert from "node:assert/strict";
import { buildThreadParticipantFilter } from "@/lib/messaging/threads";

void test("thread participant filter respects role", () => {
  const filter = buildThreadParticipantFilter("tenant", "user-1");
  assert.equal(filter, "tenant_id.eq.user-1,host_id.eq.user-1");

  const hostFilter = buildThreadParticipantFilter("landlord", "host-1");
  assert.equal(hostFilter, "tenant_id.eq.host-1,host_id.eq.host-1");

  const adminFilter = buildThreadParticipantFilter("admin", "admin-1");
  assert.equal(adminFilter, null);
});
