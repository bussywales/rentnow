import test from "node:test";
import assert from "node:assert/strict";
import { canAccessLeadNotes, normalizeLeadTag } from "../../lib/leads/lead-notes";

void test("lead notes access allows owners", () => {
  const ok = canAccessLeadNotes({ role: "agent", userId: "user-1", ownerId: "user-1" });
  assert.equal(ok, true);
});

void test("lead notes access blocks tenants", () => {
  const ok = canAccessLeadNotes({ role: "tenant", userId: "user-2", ownerId: "user-1" });
  assert.equal(ok, false);
});

void test("lead notes access allows admins", () => {
  const ok = canAccessLeadNotes({ role: "admin", userId: "admin-1", ownerId: "owner-1" });
  assert.equal(ok, true);
});

void test("lead tag normalization slugifies and trims", () => {
  assert.equal(normalizeLeadTag("  Hot Lead "), "hot-lead");
  assert.equal(normalizeLeadTag("VIP_client!!"), "vip-client");
  assert.equal(normalizeLeadTag("a".repeat(40))?.length, 32);
  assert.equal(normalizeLeadTag(""), null);
});
