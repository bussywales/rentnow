import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolvePropertyVideoPresentation } from "@/components/properties/PropertyMediaHero";

void test("property detail route renders PropertyMediaHero with featured media input", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "properties", "[id]", "page.tsx"),
    "utf8"
  );
  assert.match(pageSource, /import\s+\{\s*PropertyMediaHero\s*\}\s+from\s+"@\/components\/properties\/PropertyMediaHero"/);
  assert.match(pageSource, /<PropertyMediaHero/);
  assert.match(pageSource, /hasVideo=\{/);
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
  assert.match(heroSource, /id="property-video-tour"/);
  assert.match(heroSource, /data-testid="property-video-tour-chip"/);
  assert.match(heroSource, /data-testid="property-video-tour-section"/);
  assert.match(heroSource, /<PropertyGallery images=\{images\} title=\{title\} isDemo=\{isDemo\} \/>/);
  assert.doesNotMatch(heroSource, /\{images\.length > 0 \? \(/);
});

void test("video tour presentation shows chip and section when listing has video but featured media is image", () => {
  const presentation = resolvePropertyVideoPresentation({
    hasVideo: true,
    featuredMedia: "image",
  });
  assert.equal(presentation.prefersVideoHero, false);
  assert.equal(presentation.showVideoTourChip, true);
  assert.equal(presentation.showInlineVideoSection, true);
});

void test("video tour presentation keeps video hero and chip when featured media is video", () => {
  const presentation = resolvePropertyVideoPresentation({
    hasVideo: true,
    featuredMedia: "video",
  });
  assert.equal(presentation.prefersVideoHero, true);
  assert.equal(presentation.showVideoTourChip, true);
  assert.equal(presentation.showInlineVideoSection, false);
});

void test("video hero falls back to image when featured video has no valid video signal", () => {
  const presentation = resolvePropertyVideoPresentation({
    hasVideo: false,
    featuredMedia: "video",
  });
  assert.equal(presentation.prefersVideoHero, false);
  assert.equal(presentation.showVideoTourChip, false);
  assert.equal(presentation.showInlineVideoSection, false);
});
