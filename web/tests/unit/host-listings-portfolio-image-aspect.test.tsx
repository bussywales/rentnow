import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host listings portfolio view enforces consistent media ratio and object-cover", () => {
  const managerPath = path.join(process.cwd(), "components", "host", "HostListingsManager.tsx");
  const gridPath = path.join(process.cwd(), "components", "host", "HostListingsMasonryGrid.tsx");

  const managerSource = fs.readFileSync(managerPath, "utf8");
  const gridSource = fs.readFileSync(gridPath, "utf8");

  assert.match(managerSource, /<HostListingsMasonryGrid[\s\S]*?uniformMedia/);
  assert.match(gridSource, /uniformMedia \? "aspect-\[4\/3\]"/);
  assert.match(gridSource, /className="h-full w-full object-cover/);
  assert.match(gridSource, /max-h-\[60vh\]/);
});
