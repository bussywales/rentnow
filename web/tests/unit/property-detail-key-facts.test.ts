import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property detail includes key facts section for listing details", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "properties",
    "[id]",
    "page.tsx"
  );
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(contents.includes("Key facts"), "expected Key facts heading");
  assert.ok(
    contents.includes("Listing type"),
    "expected listing type label in key facts"
  );
  assert.ok(
    contents.includes("Security deposit"),
    "expected security deposit label in key facts"
  );
  assert.ok(
    contents.includes("Local living details"),
    "expected local living details section on property detail"
  );
  assert.ok(
    contents.includes("Owner-provided practical details for this specific listing."),
    "expected local living details explainer"
  );
  assert.ok(
    contents.includes("buildCommercialSpaceFacts(property)"),
    "expected property detail to build commercial space facts"
  );
  assert.ok(
    contents.includes("spatialModel === \"commercial\""),
    "expected property detail to branch commercial space rendering"
  );
});
