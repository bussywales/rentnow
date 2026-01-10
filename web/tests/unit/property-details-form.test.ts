import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property details step includes listing detail fields", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(
    contents.includes("Listing type"),
    "expected listing type label in details step"
  );
  assert.ok(
    contents.includes("Bathroom privacy"),
    "expected bathroom privacy label in details step"
  );
  assert.ok(
    contents.includes("Pets allowed"),
    "expected pets allowed toggle in details step"
  );
  assert.ok(
    contents.includes("State / Region"),
    "expected state/region label in details step"
  );
  assert.ok(
    contents.includes("Size value"),
    "expected size value label in details step"
  );
  assert.ok(
    contents.includes("Size unit"),
    "expected size unit label in details step"
  );
  assert.ok(
    contents.includes("Year built"),
    "expected year built label in details step"
  );
  assert.ok(
    contents.includes("Security deposit"),
    "expected security deposit label in details step"
  );
  assert.ok(
    contents.includes("Deposit currency"),
    "expected deposit currency label in details step"
  );
  assert.ok(
    contents.includes("deposit_currency"),
    "expected deposit_currency to be wired in details payload"
  );
});
