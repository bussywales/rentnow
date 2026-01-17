import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property card prefers cover_image_url for hero image", () => {
  const cardPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyCard.tsx"
  );
  const contents = fs.readFileSync(cardPath, "utf8");

  assert.ok(
    contents.includes("property.cover_image_url || property.images?.[0]?.image_url"),
    "expected PropertyCard to use cover_image_url before falling back to first image"
  );
});
