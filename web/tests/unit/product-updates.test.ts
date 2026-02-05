import test from "node:test";
import assert from "node:assert/strict";
import {
  countUnreadUpdates,
  filterPublishedUpdatesForRole,
  getAllowedProductUpdateAudiences,
} from "@/lib/product-updates/audience";

void test("product updates audience filters respect role + published state", () => {
  const updates = [
    { id: "1", audience: "all", published_at: "2026-02-01T10:00:00Z" },
    { id: "2", audience: "tenant", published_at: "2026-02-01T10:00:00Z" },
    { id: "3", audience: "host", published_at: "2026-02-01T10:00:00Z" },
    { id: "4", audience: "admin", published_at: "2026-02-01T10:00:00Z" },
    { id: "5", audience: "tenant", published_at: null },
  ];

  const tenant = filterPublishedUpdatesForRole(updates, "tenant");
  assert.deepEqual(tenant.map((row) => row.id), ["1", "2"]);

  const landlord = filterPublishedUpdatesForRole(updates, "landlord");
  assert.deepEqual(landlord.map((row) => row.id), ["1", "3"]);

  const agent = filterPublishedUpdatesForRole(updates, "agent");
  assert.deepEqual(agent.map((row) => row.id), ["1", "3"]);

  const admin = filterPublishedUpdatesForRole(updates, "admin");
  assert.deepEqual(admin.map((row) => row.id), ["1", "2", "3", "4"]);

  const adminOnly = filterPublishedUpdatesForRole(updates, "admin", {
    adminViewMode: "admin",
  });
  assert.deepEqual(adminOnly.map((row) => row.id), ["4"]);

  const anon = filterPublishedUpdatesForRole(updates, null);
  assert.deepEqual(anon.map((row) => row.id), ["1"]);
});

void test("product updates unread count subtracts reads", () => {
  const updates = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const reads = [{ update_id: "a" }, { update_id: "c" }];

  assert.equal(countUnreadUpdates(updates, reads), 1);
});

void test("audience helpers map roles", () => {
  assert.deepEqual(getAllowedProductUpdateAudiences("tenant"), ["all", "tenant"]);
  assert.deepEqual(getAllowedProductUpdateAudiences("landlord"), ["all", "host"]);
  assert.deepEqual(getAllowedProductUpdateAudiences("agent"), ["all", "host"]);
  assert.deepEqual(getAllowedProductUpdateAudiences("admin"), [
    "all",
    "tenant",
    "host",
    "admin",
  ]);
  assert.deepEqual(
    getAllowedProductUpdateAudiences("admin", { adminViewMode: "admin" }),
    ["admin"]
  );
  assert.deepEqual(getAllowedProductUpdateAudiences("tenant", { adminViewMode: "admin" }), [
    "all",
    "tenant",
  ]);
  assert.deepEqual(getAllowedProductUpdateAudiences(null), ["all"]);
});
