import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property form defaults rent period to monthly", () => {
  const formPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyForm.tsx"
  );
  const contents = fs.readFileSync(formPath, "utf8");

  assert.ok(
    contents.includes("rent_period: initialData?.rent_period ?? \"monthly\""),
    "expected rent_period default in PropertyForm"
  );
  assert.ok(
    contents.includes("name=\"rent_period\""),
    "expected rent_period radios in PropertyForm"
  );
  assert.ok(
    contents.includes("handleChange(\"rent_period\", \"yearly\")"),
    "expected rent_period yearly toggle in PropertyForm"
  );
  assert.ok(
    contents.includes("min={1}"),
    "expected price input to enforce min=1 in PropertyForm"
  );
  assert.ok(
    contents.includes("How often is rent paid?"),
    "expected rent period helper text in PropertyForm"
  );
});

void test("property stepper defaults rent period to monthly", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(
    contents.includes("rent_period: initialData?.rent_period ?? \"monthly\""),
    "expected rent_period default in PropertyStepper"
  );
  assert.ok(
    contents.includes("name=\"rent_period\""),
    "expected rent_period radios in PropertyStepper"
  );
  assert.ok(
    contents.includes("handleChange(\"rent_period\", \"yearly\")"),
    "expected rent_period yearly toggle in PropertyStepper"
  );
  assert.ok(
    contents.includes("min={1}"),
    "expected price input to enforce min=1 in PropertyStepper"
  );
  assert.ok(
    contents.includes("How often is rent paid?"),
    "expected rent period helper text in PropertyStepper"
  );
});
