import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readComponent(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

void test("host listings feed Manage all links point to canonical listings manager route", () => {
  const masonry = readComponent("components/host/HostListingsMasonryGrid.tsx");
  const rail = readComponent("components/host/HostListingsRail.tsx");

  assert.match(
    masonry,
    /<Link[\s\S]*?href="\/host\/properties"[\s\S]*?>\s*Manage all\s*<\/Link>/m
  );
  assert.match(
    rail,
    /<Link[\s\S]*?href="\/host\/properties"[\s\S]*?>\s*Manage all\s*<\/Link>/m
  );
});

