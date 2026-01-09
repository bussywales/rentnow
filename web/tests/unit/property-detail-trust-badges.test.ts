import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property detail renders trust badges from snapshot", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "properties",
    "[id]",
    "page.tsx"
  );
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(contents.includes("TrustBadges"), "expected TrustBadges usage");
  assert.ok(
    contents.includes("markers={hostTrust}"),
    "expected TrustBadges to receive hostTrust"
  );
  assert.ok(
    contents.includes("fetchTrustPublicSnapshots"),
    "expected trust snapshot helper usage"
  );
});

void test("property detail hides trust badges when snapshot is missing", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "properties",
    "[id]",
    "page.tsx"
  );
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("hostTrust &&"),
    "expected trust badges to render only when hostTrust is present"
  );
});
