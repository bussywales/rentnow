import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("workspace home wires host featured strip component with the visual landing section", () => {
  const pagePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.match(
    contents,
    /<HostFeaturedStrip listings=\{dashboardListings\} mosaicTargetId=\"home-for-you-grid\" \/>/,
    "expected host featured strip component wiring"
  );
  assert.match(
    contents,
    /data-testid=\"home-featured-strip\"/,
    "expected featured strip section marker"
  );
});
