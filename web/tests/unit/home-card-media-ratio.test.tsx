import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("/home uses uniform media ratio mode for for-you grid cards", () => {
  const feedPath = path.join(process.cwd(), "components", "home", "WorkspaceHomeFeed.tsx");
  const source = fs.readFileSync(feedPath, "utf8");

  assert.match(
    source,
    /<HostListingsMasonryGrid listings=\{listings\} uniformMedia \/>/,
    "expected /home to opt into uniform media ratio mode"
  );
});

void test("host listings masonry grid enforces fixed aspect ratio when uniform mode is enabled", () => {
  const gridPath = path.join(process.cwd(), "components", "host", "HostListingsMasonryGrid.tsx");
  const source = fs.readFileSync(gridPath, "utf8");

  assert.match(
    source,
    /uniformMedia \? \"aspect-\[4\/3\]\" : getHostListingTileAspectClass\(pattern\)/,
    "expected uniform mode to force aspect-[4/3]"
  );
  assert.match(source, /className=\"h-full w-full object-cover/, "expected card media image to use object-cover");
});
