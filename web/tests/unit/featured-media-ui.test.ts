import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("properties migration adds featured_media with image default and check constraint", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260305130000_properties_featured_media.sql"
  );
  const source = fs.readFileSync(migrationPath, "utf8");
  assert.match(source, /add column if not exists featured_media text not null default 'image'/i);
  assert.match(source, /check \(featured_media in \('image', 'video'\)\)/i);
});

void test("properties create and update schemas accept featured_media", () => {
  const createRoute = fs.readFileSync(
    path.join(process.cwd(), "app", "api", "properties", "route.ts"),
    "utf8"
  );
  const updateRoute = fs.readFileSync(
    path.join(process.cwd(), "app", "api", "properties", "[id]", "route.ts"),
    "utf8"
  );
  assert.match(createRoute, /featured_media:\s*z\.enum\(\["image",\s*"video"\]\)\.optional\(\)\.nullable\(\)/);
  assert.match(updateRoute, /featured_media:\s*z\.enum\(\["image",\s*"video"\]\)\.optional\(\)\.nullable\(\)/);
});

void test("property stepper exposes featured media toggle only when video exists", () => {
  const stepper = fs.readFileSync(
    path.join(process.cwd(), "components", "properties", "PropertyStepper.tsx"),
    "utf8"
  );
  assert.match(stepper, /Use video as featured media/);
  assert.match(stepper, /checked=\{form\.featured_media === "video"\}/);
  assert.match(stepper, /disabled=\{!videoPath\}/);
  assert.match(stepper, /handleChange\(\s*"featured_media",\s*event\.target\.checked \? "video" : "image"\s*\)/);
});

void test("property and explore cards render video badge when featured media is video", () => {
  const propertyCard = fs.readFileSync(
    path.join(process.cwd(), "components", "properties", "PropertyCard.tsx"),
    "utf8"
  );
  const exploreV2Card = fs.readFileSync(
    path.join(process.cwd(), "components", "explore-v2", "ExploreV2Card.tsx"),
    "utf8"
  );
  const exploreGallery = fs.readFileSync(
    path.join(process.cwd(), "components", "explore", "ExploreGallery.tsx"),
    "utf8"
  );
  assert.match(propertyCard, /data-testid="property-card-video-badge"/);
  assert.match(exploreV2Card, /data-testid="explore-v2-video-badge"/);
  assert.match(exploreGallery, /data-testid="explore-gallery-video-badge"/);
});
