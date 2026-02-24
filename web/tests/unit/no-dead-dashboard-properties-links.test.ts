import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SOURCES = [
  "lib/dashboard/nav.ts",
  "lib/workspace/sidebar-model.ts",
  "app/home/page.tsx",
  "components/home/WorkspaceHomeFeed.tsx",
  "components/host/HostListingsMasonryGrid.tsx",
  "components/host/HostListingsRail.tsx",
] as const;

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

void test("workspace and nav link sources do not reference legacy /dashboard/properties index route", () => {
  const legacyIndexPattern = /\/dashboard\/properties(?=["'`?])/;

  for (const relativePath of SOURCES) {
    const source = readSource(relativePath);
    assert.doesNotMatch(
      source,
      legacyIndexPattern,
      `expected ${relativePath} to avoid /dashboard/properties index links`
    );
  }
});

void test("manage-all style CTAs point to canonical /host/listings manager route", () => {
  const masonry = readSource("components/host/HostListingsMasonryGrid.tsx");
  const rail = readSource("components/host/HostListingsRail.tsx");
  const homeFeed = readSource("components/home/WorkspaceHomeFeed.tsx");

  assert.match(masonry, /href="\/host\/listings\?view=manage"/);
  assert.match(rail, /href="\/host\/listings\?view=manage"/);
  assert.match(homeFeed, /href=\{role === "agent" \? "\/host\/leads" : "\/host\/listings\?view=manage"\}/);
});
