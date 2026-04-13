import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = [
  "/Users/olubusayoadewale/rentnow/web/components/host/HostListingsMasonryGrid.tsx",
  "/Users/olubusayoadewale/rentnow/web/components/host/HostListingsRail.tsx",
  "/Users/olubusayoadewale/rentnow/web/components/host/HostFeaturedStrip.tsx",
];

void test("host listing surfaces resolve badge labels from effective visual status", () => {
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /resolveListingApprovalVisualStatus/);
    assert.doesNotMatch(source, /mapStatusLabel\(listing\.status\)/);
    assert.doesNotMatch(source, /statusChipClass\(listing\.status \?\? null\)/);
  }
});
