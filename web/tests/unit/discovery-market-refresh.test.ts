import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("home featured strip source stays market-reactive", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileFeaturedDiscoveryStrip.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /useMarketPreference/);
  assert.match(source, /\[market\.country\]/);
  assert.match(source, /data-market-country=\{market\.country\}/);
});

void test("shortlets and properties featured rails expose current market marker", () => {
  const shortletsSource = fs.readFileSync(
    path.join(process.cwd(), "components", "shortlets", "discovery", "ShortletsFeaturedRail.tsx"),
    "utf8"
  );
  const propertiesSource = fs.readFileSync(
    path.join(process.cwd(), "components", "properties", "discovery", "PropertiesFeaturedRail.tsx"),
    "utf8"
  );

  assert.match(shortletsSource, /useMarketPreference/);
  assert.match(shortletsSource, /\[market\.country\]/);
  assert.match(shortletsSource, /data-market-country=\{market\.country\}/);

  assert.match(propertiesSource, /useMarketPreference/);
  assert.match(propertiesSource, /\[market\.country\]/);
  assert.match(propertiesSource, /data-market-country=\{market\.country\}/);
});
