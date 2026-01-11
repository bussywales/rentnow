import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property stepper writes country_code alongside country", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(
    contents.includes("country_code: initialData?.country_code"),
    "expected PropertyStepper to initialize country_code"
  );
  assert.ok(
    contents.includes("handleChange(\"country_code\""),
    "expected PropertyStepper to write country_code on selection"
  );
});
