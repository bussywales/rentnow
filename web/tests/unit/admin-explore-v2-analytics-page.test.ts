import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin explore v2 conversion page renders trust cue experiment section", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "analytics", "explore-v2", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("Trust cue experiment"),
    "expected trust cue experiment section title"
  );
  assert.ok(
    contents.includes('data-testid="admin-explore-v2-conversion-trust-cue"'),
    "expected trust cue section test id"
  );
  assert.ok(
    contents.includes('rowsByKey.get("instant_confirmation")'),
    "expected trust cue variant ordering key"
  );
  assert.ok(
    contents.includes("Older rows without `trust_cue_variant` are"),
    "expected legacy row handling note"
  );
  assert.ok(
    contents.includes("Primary CTR"),
    "expected primary conversion column"
  );
  assert.ok(
    contents.includes("View details CTR"),
    "expected details conversion column"
  );
});
