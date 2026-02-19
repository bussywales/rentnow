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
const settingsFormPath = path.join(
  process.cwd(),
  "components",
  "host",
  "HostShortletSettingsForm.tsx"
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
  assert.match(routeSource, /cancellation_policy/);
});

void test("host settings ui avoids confusing non-shortlet warning copy", () => {
  const conversionSource = fs.readFileSync(conversionCardPath, "utf8");
  const settingsFormSource = fs.readFileSync(settingsFormPath, "utf8");

  assert.equal(
    conversionSource.includes("Only shortlet listings can use shortlet availability settings."),
    false
  );
  assert.equal(
    settingsFormSource.includes("Only shortlet listings can use shortlet availability settings."),
    false
  );
  assert.match(settingsFormSource, /Cancellation policy/);
  assert.match(settingsFormSource, /flexible_48h/);
});
