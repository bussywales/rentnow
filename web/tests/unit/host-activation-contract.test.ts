import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host page surfaces activation summary before the listings feed", () => {
  const hostPagePath = path.join(process.cwd(), "app", "host", "page.tsx");
  const source = fs.readFileSync(hostPagePath, "utf8");

  const heroIndex = source.indexOf('data-testid="host-home-hero"');
  const activationIndex = source.indexOf('data-testid="host-home-activation-summary"');
  const listingsFeedIndex = source.indexOf("<HostListingsFeed");

  assert.ok(activationIndex >= 0, "expected host activation summary marker");
  assert.ok(heroIndex >= 0, "expected host hero marker");
  assert.ok(listingsFeedIndex >= 0, "expected host listings feed marker");
  assert.ok(heroIndex < activationIndex, "expected activation summary below the hero");
  assert.ok(activationIndex < listingsFeedIndex, "expected activation summary before the listings feed");
  assert.match(source, /resolveSubscriptionLifecycleState/);
  assert.match(source, /What this plan unlocks/);
  assert.match(source, /Billing source/);
  assert.match(source, /Open next step/);
});

void test("dashboard layout lists the exact missing host profile fields in the banner", () => {
  const layoutPath = path.join(process.cwd(), "app", "dashboard", "layout.tsx");
  const source = fs.readFileSync(layoutPath, "utf8");

  assert.match(source, /listMissingHostProfileFields/);
  assert.match(source, /Missing: \{missingHostProfileFields\.join\(", "\)\}/);
  assert.match(source, /preferredContact: profile\?\.preferred_contact \?\? null/);
});
