import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property stepper basics layout groups pricing into a card", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(
    contents.includes("Pricing & availability"),
    "expected pricing card heading"
  );
  assert.ok(contents.includes("Price"), "expected price field in pricing card");
  assert.ok(contents.includes("Currency"), "expected currency field in pricing card");
  assert.ok(contents.includes("Rent period"), "expected rent period in pricing card");
  assert.ok(
    contents.includes("Available from"),
    "expected available from in pricing card"
  );
  assert.ok(contents.includes("Furnished"), "expected furnished toggle in pricing card");
});
