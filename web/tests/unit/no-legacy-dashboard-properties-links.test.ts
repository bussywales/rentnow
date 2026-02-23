import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SOURCES = [
  "app/home/page.tsx",
  "components/layout/MainNav.tsx",
  "components/leads/LeadInboxClient.tsx",
  "components/host/HostListingsMasonryGrid.tsx",
  "components/host/HostListingsRail.tsx",
  "lib/dashboard/nav.ts",
  "lib/workspace/sidebar-model.ts",
];

void test("workspace and nav surfaces no longer reference legacy /dashboard/properties index route", () => {
  const legacyIndexHrefPattern = /\/dashboard\/properties(?=["'`])/;

  for (const relativePath of SOURCES) {
    const absolutePath = path.join(process.cwd(), relativePath);
    const source = fs.readFileSync(absolutePath, "utf8");
    assert.doesNotMatch(
      source,
      legacyIndexHrefPattern,
      `expected ${relativePath} to avoid legacy /dashboard/properties index href`
    );
  }
});
