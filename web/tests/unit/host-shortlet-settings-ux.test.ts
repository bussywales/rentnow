import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const settingsPagePath = path.join(
  process.cwd(),
  "app",
  "host",
  "shortlets",
  "[id]",
  "settings",
  "page.tsx"
);
const conversionCardPath = path.join(
  process.cwd(),
  "components",
  "host",
  "HostShortletConversionCard.tsx"
);
const settingsApiPath = path.join(
  process.cwd(),
  "app",
  "api",
  "shortlet",
  "settings",
  "[propertyId]",
  "route.ts"
);

void test("non-shortlet host settings path renders conversion CTA state", () => {
  const pageSource = fs.readFileSync(settingsPagePath, "utf8");
  const cardSource = fs.readFileSync(conversionCardPath, "utf8");

  assert.match(pageSource, /HostShortletConversionCard/);
  assert.match(cardSource, /Convert this listing to a shortlet/);
});

void test("shortlet settings api returns structured shortlet guard code", () => {
  const routeSource = fs.readFileSync(settingsApiPath, "utf8");
  assert.match(routeSource, /SHORTLET_LISTING_REQUIRED/);
  assert.match(routeSource, /reason:\s*shortletManageState\.reason/);
});
