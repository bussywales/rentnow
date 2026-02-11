import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property detail links hosted-by section to advertiser profile", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "[id]", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("resolvePublicAdvertiserHref"),
    "expected hosted-by block to resolve /agents/[slug] with /u fallback"
  );
});

void test("property card can render advertiser profile link when name is available", () => {
  const cardPath = path.join(process.cwd(), "components", "properties", "PropertyCard.tsx");
  const contents = fs.readFileSync(cardPath, "utf8");

  assert.ok(
    contents.includes("resolvePublicAdvertiserHref"),
    "expected property card advertiser link to prefer /agents/[slug]"
  );
});
