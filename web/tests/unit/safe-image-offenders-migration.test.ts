import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migratedFiles = [
  "components/home/HomeListingRail.tsx",
  "components/explore/ExploreDetailsSheet.tsx",
  "components/admin/AdminReviewDrawer.tsx",
  "components/admin/AdminProductUpdatesPanel.tsx",
] as const;

void test("guarded surfaces use SafeImage instead of direct next/image", () => {
  for (const relativePath of migratedFiles) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
    assert.doesNotMatch(
      source,
      /from\s+[\"']next\/image[\"']/,
      `${relativePath} should not import next/image directly`
    );
    assert.match(source, /from\s+[\"']@\/components\/ui\/SafeImage[\"']/, `${relativePath} should import SafeImage`);
  }
});
