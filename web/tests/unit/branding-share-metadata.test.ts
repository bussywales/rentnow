import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRAND_OG_SHARE_IMAGE, BRAND_SOCIAL_TAGLINE } from "@/lib/brand";

void test("brand social metadata constants point to default OG image and tagline", () => {
  assert.equal(BRAND_OG_SHARE_IMAGE, "/og-default.png");
  assert.equal(BRAND_SOCIAL_TAGLINE, "PropatyHub — Rent • Buy • Shortlets");
});

void test("root metadata uses large Twitter card and default OG image", () => {
  const layoutSource = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
  assert.match(layoutSource, /card:\s*"summary_large_image"/);
  assert.match(layoutSource, /BRAND_OG_SHARE_IMAGE/);
  assert.match(layoutSource, /BRAND_SOCIAL_TAGLINE/);
});
