import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property stepper latitude/longitude tooltip copy is present", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(contents.includes("How to find coordinates"), "expected tooltip title");
  assert.ok(
    contents.includes("Latitude and longitude help"),
    "expected tooltip aria label"
  );
  assert.ok(
    contents.includes("Google Maps (recommended): Search the address"),
    "expected Google Maps instruction"
  );
});
