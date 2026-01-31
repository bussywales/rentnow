import test from "node:test";
import assert from "node:assert/strict";
import { buildPropertyShareToken, resolvePropertyShareStatus, canManagePropertyShare } from "@/lib/sharing/property-share";

void test("buildPropertyShareToken returns url-safe tokens", () => {
  const token = buildPropertyShareToken();
  assert.ok(token.length >= 40);
  assert.ok(!token.includes("+"));
  assert.ok(!token.includes("/"));
});

void test("resolvePropertyShareStatus handles revoked/expired", () => {
  assert.equal(
    resolvePropertyShareStatus({ expires_at: new Date(Date.now() + 1000).toISOString(), revoked_at: null }),
    "active"
  );
  assert.equal(
    resolvePropertyShareStatus({ expires_at: new Date(Date.now() - 1000).toISOString(), revoked_at: null }),
    "expired"
  );
  assert.equal(
    resolvePropertyShareStatus({ expires_at: null, revoked_at: new Date().toISOString() }),
    "revoked"
  );
});

void test("canManagePropertyShare enforces owner/admin", () => {
  assert.equal(
    canManagePropertyShare({ role: "admin", userId: "u1", ownerId: "u2" }),
    true
  );
  assert.equal(
    canManagePropertyShare({ role: "landlord", userId: "u1", ownerId: "u1" }),
    true
  );
  assert.equal(
    canManagePropertyShare({ role: "agent", userId: "u1", ownerId: "u2" }),
    false
  );
  assert.equal(
    canManagePropertyShare({ role: null, userId: "u1", ownerId: "u1" }),
    false
  );
});
