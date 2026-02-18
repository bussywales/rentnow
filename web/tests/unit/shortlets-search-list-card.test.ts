import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const cardPath = path.join(
  process.cwd(),
  "components",
  "shortlets",
  "search",
  "ShortletsSearchListCard.tsx"
);

void test("shortlets search card keeps layout calm with clamped title and no description block", () => {
  const contents = fs.readFileSync(cardPath, "utf8");

  assert.ok(contents.includes("line-clamp-1 text-base font-semibold"));
  assert.ok(contents.includes("/ night"));
  assert.equal(contents.includes("property.description"), false);
});

void test("shortlets search card uses primary image first with fallback on error", () => {
  const contents = fs.readFileSync(cardPath, "utf8");

  assert.ok(contents.includes("property.primaryImageUrl || property.cover_image_url || FALLBACK_IMAGE"));
  assert.ok(contents.includes("onError={() => setImageSrc(FALLBACK_IMAGE)}"));
});
