import test from "node:test";
import assert from "node:assert/strict";
import { shouldEnableGlassTooltip } from "@/components/ui/GlassTooltip";
import { isElementTruncated } from "@/lib/ui/useIsTruncated";

void test("isElementTruncated returns true when width overflows", () => {
  assert.equal(
    isElementTruncated({
      clientWidth: 120,
      scrollWidth: 180,
      clientHeight: 20,
      scrollHeight: 20,
    }),
    true
  );
});

void test("isElementTruncated returns true when height overflows", () => {
  assert.equal(
    isElementTruncated({
      clientWidth: 120,
      scrollWidth: 120,
      clientHeight: 20,
      scrollHeight: 42,
    }),
    true
  );
});

void test("isElementTruncated returns false when dimensions fit", () => {
  assert.equal(
    isElementTruncated({
      clientWidth: 120,
      scrollWidth: 120,
      clientHeight: 20,
      scrollHeight: 20,
    }),
    false
  );
});

void test("glass tooltip helper only enables tooltip for truncated non-empty content", () => {
  assert.equal(
    shouldEnableGlassTooltip({
      content: "Ocean view apartment with dual lounge and rooftop terrace",
      isTruncated: true,
    }),
    true
  );
  assert.equal(
    shouldEnableGlassTooltip({
      content: "Ocean view apartment",
      isTruncated: false,
    }),
    false
  );
  assert.equal(
    shouldEnableGlassTooltip({
      content: "   ",
      isTruncated: true,
    }),
    false
  );
});
