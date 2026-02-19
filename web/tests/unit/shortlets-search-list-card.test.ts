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
  assert.ok(contents.includes("Price on request"));
  assert.ok(contents.includes("/ night"));
  assert.equal(contents.includes("property.description"), false);
});

void test("shortlets search card renders dedicated carousel surface", () => {
  const contents = fs.readFileSync(cardPath, "utf8");

  assert.ok(contents.includes("ShortletsSearchCardCarousel"));
  assert.ok(contents.includes("imageUrls={property.imageUrls}"));
  assert.ok(contents.includes("fallbackImage={FALLBACK_IMAGE}"));
});

void test("shortlets search card renders one primary CTA and one priority badge", () => {
  const contents = fs.readFileSync(cardPath, "utf8");

  assert.ok(contents.includes("const ctaLabel ="));
  assert.ok(contents.includes('bookingMode === "instant" ? "Reserve"'));
  assert.ok(contents.includes('bookingMode === "request" ? "Request" : "View"'));
  assert.ok(contents.includes("const badgeLabel = property.verifiedHost ? \"Verified\" : property.is_featured ? \"Featured\" : showNewBadge ? \"New\" : null"));
  assert.equal(contents.includes("Top stay"), false);
});
