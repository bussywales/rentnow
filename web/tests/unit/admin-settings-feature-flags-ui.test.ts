import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("app settings keys include listings auto-approve toggle", () => {
  const keysPath = path.join(process.cwd(), "lib", "settings", "app-settings-keys.ts");
  const source = fs.readFileSync(keysPath, "utf8");

  assert.match(source, /listingsAutoApproveEnabled:\s*"listings_auto_approve_enabled"/);
});

void test("admin settings page loads listings auto-approve toggle data", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "settings", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /APP_SETTING_KEYS\.listingsAutoApproveEnabled/);
});

void test("admin feature flags UI renders listings auto-approve label", () => {
  const uiPath = path.join(process.cwd(), "components", "admin", "AdminSettingsFeatureFlags.tsx");
  const source = fs.readFileSync(uiPath, "utf8");

  assert.match(source, /Listings auto-approve on submit/);
  assert.match(source, /APP_SETTING_KEYS\.listingsAutoApproveEnabled/);
});
