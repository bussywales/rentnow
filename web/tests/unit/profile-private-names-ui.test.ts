import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("profile form renders private first and surname fields with non-public helper copy", () => {
  const filePath = path.join(process.cwd(), "components", "profile", "ProfileFormClient.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /First name \(private\)/);
  assert.match(source, /Surname \(private\)/);
  assert.match(source, /Used for support and account verification\. Not shown publicly\./);
});

void test("profile save payload persists private name fields", () => {
  const filePath = path.join(process.cwd(), "components", "profile", "ProfileFormClient.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /first_name:\s*firstName\.trim\(\)\s*\|\|\s*null/);
  assert.match(source, /last_name:\s*lastName\.trim\(\)\s*\|\|\s*null/);
  assert.match(source, /listing_review_email_enabled:\s*listingReviewEmailEnabled/);
  assert.match(source, /property_request_alerts_enabled:\s*propertyRequestAlertsEnabled/);
});

void test("profile page and profile ensure helper select private name fields", () => {
  const pagePath = path.join(process.cwd(), "app", "profile", "page.tsx");
  const pageSource = fs.readFileSync(pagePath, "utf8");
  assert.match(pageSource, /ensureProfileRow/);

  const ensurePath = path.join(process.cwd(), "lib", "profile", "ensure-profile.ts");
  const ensureSource = fs.readFileSync(ensurePath, "utf8");
  assert.match(ensureSource, /first_name,\s*last_name/);
  assert.match(ensureSource, /listing_review_email_enabled/);
  assert.match(ensureSource, /property_request_alerts_enabled/);
});

void test("profile form includes admin listing review email toggle copy", () => {
  const filePath = path.join(process.cwd(), "components", "profile", "ProfileFormClient.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /Email me when a new listing is submitted for review/);
  assert.match(source, /admin-listing-review-email-toggle/);
});

void test("profile form includes host property request alerts toggle copy", () => {
  const filePath = path.join(process.cwd(), "components", "profile", "ProfileFormClient.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /Email me when a new property request is published in my market/);
  assert.match(source, /property-request-alerts-toggle/);
});
