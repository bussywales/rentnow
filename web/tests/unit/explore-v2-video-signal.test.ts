import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("explore feed requests lightweight video signal for card badges", () => {
  const searchSource = fs.readFileSync(path.join(process.cwd(), "lib", "search.ts"), "utf8");
  const exploreFeedSource = fs.readFileSync(
    path.join(process.cwd(), "lib", "explore", "explore-feed.server.ts"),
    "utf8"
  );

  assert.match(searchSource, /includeVideoSignal\?: boolean/);
  assert.match(searchSource, /const selectWithVideoSignal = `[\s\S]*property_videos\(id\)`;/);
  assert.match(
    searchSource,
    /\.select\(options\.includeVideoSignal \? selectWithVideoSignal : selectWithoutVideoSignal,\s*\{/
  );
  assert.match(exploreFeedSource, /includeVideoSignal:\s*true/);
  assert.match(exploreFeedSource, /const hasVideo =[\s\S]*row\.property_videos/);
  assert.match(exploreFeedSource, /has_video:\s*hasVideo/);
});
