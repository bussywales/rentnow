import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host listing actions menu opens upward with an anchored panel id", () => {
  const filePath = path.join(process.cwd(), "components", "host", "HostListingActionsMenu.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /const panelId = `host-listing-actions-panel-\$\{listingId\}`/);
  assert.match(source, /aria-controls=\{panelId\}/);
  assert.match(source, /absolute bottom-full right-0 z-40 mb-1\.5/);
  assert.match(source, /data-testid=\{panelId\}/);
});
