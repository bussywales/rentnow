import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("/host/listings is a distinct manager route (not a re-export)", () => {
  const routePath = path.join(process.cwd(), "app", "host", "listings", "page.tsx");
  const source = fs.readFileSync(routePath, "utf8");

  assert.doesNotMatch(source, /export\s+\{\s*default\s*\}\s+from\s+"..\/page"/);
  assert.match(source, /HostListingsManager/);
  assert.match(source, /data-testid="host-listings-page"/);
  assert.match(source, /fetchOwnerListings/);
  assert.match(source, /computeDashboardListings/);
});
