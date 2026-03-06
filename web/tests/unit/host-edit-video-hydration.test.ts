import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host edit loader preserves video metadata and normalizes image URLs for hydrated state", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "host",
    "properties",
    "[id]",
    "edit",
    "page.tsx"
  );
  const source = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    source.includes("function mapPropertyForEditInput(property: PropertyWithEditMedia): Property"),
    "expected host edit loader to centralize media mapping"
  );
  assert.ok(
    source.includes("property_videos: property.property_videos ?? null"),
    "expected host edit loader mapping to retain property_videos"
  );
  assert.ok(
    source.includes('import { resolvePropertyImageUrl, resolveSupabasePublicUrlFromPath } from "@/lib/properties/image-url";'),
    "expected host edit loader to resolve property image URLs from storage variants"
  );
  assert.ok(
    source.includes("storage_path: image.storage_path ?? null"),
    "expected mapped edit images to retain storage paths"
  );
  assert.ok(
    source.includes("const resolvedUrl ="),
    "expected mapped edit images to normalize image URLs before passing to PropertyStepper"
  );
});
