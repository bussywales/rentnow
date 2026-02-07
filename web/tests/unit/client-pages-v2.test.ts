import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClientSlugFromInput,
  isClientPagePublished,
  orderCuratedListings,
} from "@/lib/agents/client-pages";
import {
  isAllowedClientPageImageType,
  isAllowedClientPageImageSize,
} from "@/lib/agents/client-pages-storage";

void test("buildClientSlugFromInput prefers provided slug", () => {
  const slug = buildClientSlugFromInput({
    clientName: "Client Name",
    clientSlug: "vip-client",
    existing: ["vip-client", "vip-client-2"],
  });
  assert.equal(slug, "vip-client-3");
});

void test("isClientPagePublished respects expiry", () => {
  const now = new Date("2026-02-07T10:00:00Z");
  assert.equal(
    isClientPagePublished({ published: true, expiresAt: "2026-02-07T09:00:00Z", now }),
    false
  );
  assert.equal(
    isClientPagePublished({ published: true, expiresAt: "2026-02-07T11:00:00Z", now }),
    true
  );
});

void test("orderCuratedListings pins first then rank", () => {
  const ordered = orderCuratedListings([
    { id: "b", pinned: false, rank: 0 },
    { id: "a", pinned: true, rank: 2 },
    { id: "c", pinned: true, rank: 1 },
  ]);
  assert.deepEqual(
    ordered.map((item) => item.id),
    ["c", "a", "b"]
  );
});

void test("client page image validation", () => {
  assert.equal(isAllowedClientPageImageType("image/png"), true);
  assert.equal(isAllowedClientPageImageType("image/gif"), false);
  assert.equal(isAllowedClientPageImageSize(1024 * 1024), true);
  assert.equal(isAllowedClientPageImageSize(10 * 1024 * 1024), false);
});
