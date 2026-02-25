import test from "node:test";
import assert from "node:assert/strict";
import {
  getCollectionBySlug,
  resolveCollectionsRegistry,
  validateCollectionsRegistry,
} from "@/lib/collections/collections-registry";

void test("collections registry resolves static definitions with stable slugs", () => {
  const items = resolveCollectionsRegistry(new Date("2026-02-25T00:00:00.000Z"));
  assert.ok(items.length >= 6);
  assert.ok(items.some((item) => item.slug === "weekend-getaways"));
});

void test("collections registry validator rejects duplicate slugs and bad schema", () => {
  const base = resolveCollectionsRegistry(new Date("2026-02-25T00:00:00.000Z"))[0];
  const { items, warnings } = validateCollectionsRegistry({
    now: new Date("2026-02-25T00:00:00.000Z"),
    items: [
      base,
      { ...base },
      { ...base, slug: "bad slug" },
      { ...base, slug: "sensitive-copy", title: "Homes for one religion only" },
      { ...base, slug: "invalid-market-tag", marketTags: ["XX" as never] },
    ],
  });

  assert.equal(items.length, 1);
  assert.ok(warnings.some((warning) => warning.includes("duplicate slug")));
  assert.ok(warnings.some((warning) => warning.includes("slug must be kebab-case")));
  assert.ok(warnings.some((warning) => warning.includes("restricted token")));
  assert.ok(warnings.some((warning) => warning.includes("unknown market tags")));
});

void test("getCollectionBySlug returns null for unknown collection", () => {
  assert.equal(getCollectionBySlug("does-not-exist"), null);
});

