import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMobileQuickSearchPresetList,
  MOBILE_QUICKSEARCH_CATEGORY_OPTIONS,
} from "@/lib/home/mobile-quicksearch-presets";

void test("mobile quick search category options include shortlets and properties categories", () => {
  const optionKeys = MOBILE_QUICKSEARCH_CATEGORY_OPTIONS.map((option) => option.key);
  assert.deepEqual(optionKeys, ["rent", "buy", "shortlet", "off_plan", "all"]);
});

void test("mobile quick search presets return shortlet recents first when shortlet category is selected", () => {
  const presets = buildMobileQuickSearchPresetList({
    category: "shortlet",
    shortletRecents: [
      {
        id: "recent-1",
        label: "Lekki · 2 guests · Any dates",
        params: { where: "Lekki", guests: "2" },
        createdAt: "2026-02-25T00:00:00.000Z",
      },
    ],
  });

  assert.equal(presets[0]?.id, "shortlet-recent-recent-1");
  assert.equal(presets[0]?.category, "shortlet");
  assert.equal(presets[0]?.city, "Lekki");
});

void test("mobile quick search presets return category-scoped property presets for rent", () => {
  const presets = buildMobileQuickSearchPresetList({
    category: "rent",
    shortletRecents: [],
  });

  assert.ok(presets.length > 0);
  assert.ok(presets.every((preset) => preset.category === "rent"));
});
