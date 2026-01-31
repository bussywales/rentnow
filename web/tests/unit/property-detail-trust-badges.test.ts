import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property detail renders identity trust pill from snapshot", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "properties",
    "[id]",
    "page.tsx"
  );
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(contents.includes("TrustIdentityPill"), "expected TrustIdentityPill usage");
  assert.ok(
    contents.includes("markers={hostTrust}"),
    "expected TrustIdentityPill to receive hostTrust"
  );
  assert.ok(
    contents.includes("fetchTrustPublicSnapshots"),
    "expected trust snapshot helper usage"
  );
});

void test("property detail hides trust pill when snapshot is missing", () => {
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
    "expected trust pill to render only when hostTrust is present"
  );
});

void test("property detail renders rent period subtext", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "properties",
    "[id]",
    "page.tsx"
  );
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("Annual rent"),
    "expected annual rent subtext for yearly cadence"
  );
  assert.ok(
    contents.includes("Monthly rent"),
    "expected monthly rent subtext for monthly cadence"
  );
});
