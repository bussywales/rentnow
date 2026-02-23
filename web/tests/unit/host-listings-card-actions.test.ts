import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const COMPONENT_PATHS = [
  "components/host/HostFeaturedStrip.tsx",
  "components/host/HostListingsMasonryGrid.tsx",
  "components/host/HostListingsRail.tsx",
];

void test("host listing cards keep a single primary manage action and move secondary actions into kebab menu", () => {
  for (const componentPath of COMPONENT_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), componentPath), "utf8");

    assert.match(source, /Manage/, `expected ${componentPath} to expose a primary Manage action`);
    assert.match(
      source,
      /HostListingActionsMenu/,
      `expected ${componentPath} to use HostListingActionsMenu for secondary actions`
    );
    assert.doesNotMatch(
      source,
      /\/dashboard\/properties\//,
      `expected ${componentPath} to avoid legacy dashboard listing routes`
    );
  }
});
