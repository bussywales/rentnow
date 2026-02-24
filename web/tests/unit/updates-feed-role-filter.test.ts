import test from "node:test";
import assert from "node:assert/strict";
import { filterPublishedUpdatesForRole } from "@/lib/product-updates/audience";

const FEED = [
  { id: "u-all", audience: "all", published_at: "2026-02-24T09:00:00Z" },
  { id: "u-tenant", audience: "tenant", published_at: "2026-02-24T09:00:00Z" },
  { id: "u-host", audience: "host", published_at: "2026-02-24T09:00:00Z" },
  { id: "u-admin", audience: "admin", published_at: "2026-02-24T09:00:00Z" },
];

void test("tenant feed excludes host/admin-only updates", () => {
  const result = filterPublishedUpdatesForRole(FEED, "tenant");
  assert.deepEqual(result.map((row) => row.id), ["u-all", "u-tenant"]);
});

void test("host feed excludes tenant/admin-only updates", () => {
  const result = filterPublishedUpdatesForRole(FEED, "landlord");
  assert.deepEqual(result.map((row) => row.id), ["u-all", "u-host"]);
});

void test("admin feed includes all audiences", () => {
  const result = filterPublishedUpdatesForRole(FEED, "admin");
  assert.deepEqual(result.map((row) => row.id), ["u-all", "u-tenant", "u-host", "u-admin"]);
});
