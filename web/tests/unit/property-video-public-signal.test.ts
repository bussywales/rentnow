import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("public property detail route exposes a canonical has_video signal", () => {
  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app", "api", "properties", "[id]", "route.ts"),
    "utf8"
  );

  assert.match(routeSource, /normalizePropertyVideoRecords/);
  assert.match(routeSource, /probePropertyHasVideo/);
  assert.match(routeSource, /has_video:\s*hasVideo/);
});

void test("property detail page resolves video visibility from canonical signal helper", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "properties", "[id]", "page.tsx"),
    "utf8"
  );

  assert.match(pageSource, /resolvePropertyHasVideoSignal\(/);
  assert.match(pageSource, /property_videos:\s*propertyVideos/);
  assert.match(pageSource, /has_video:\s*hasVideo/);
});
