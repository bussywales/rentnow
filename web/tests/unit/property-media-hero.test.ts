import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property detail route renders PropertyMediaHero with featured media input", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "properties", "[id]", "page.tsx"),
    "utf8"
  );
  assert.match(pageSource, /import\s+\{\s*PropertyMediaHero\s*\}\s+from\s+"@\/components\/properties\/PropertyMediaHero"/);
  assert.match(pageSource, /<PropertyMediaHero/);
  assert.match(pageSource, /featuredMedia=\{property\.featured_media \?\? "image"\}/);
});

void test("property media hero requests public signed URL and exposes play affordance", () => {
  const heroSource = fs.readFileSync(
    path.join(process.cwd(), "components", "properties", "PropertyMediaHero.tsx"),
    "utf8"
  );
  assert.match(heroSource, /fetch\(`\/api\/properties\/\$\{propertyId\}\/video\/public`/);
  assert.match(heroSource, /data-testid="property-video-hero"/);
  assert.match(heroSource, /data-testid="property-video-hero-play"/);
  assert.match(heroSource, /<PropertyGallery images=\{images\} title=\{title\} isDemo=\{isDemo\} \/>/);
});
