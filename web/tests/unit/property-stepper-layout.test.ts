import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property stepper basics layout groups bottom fields into two columns", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(
    contents.includes("lg:grid-cols-[2fr_1fr]"),
    "expected two-column wrapper for the bottom row groups"
  );
  assert.ok(
    contents.includes("lg:grid-cols-[1fr_1fr_1.4fr]"),
    "expected widened rent period column in the pricing group"
  );
  assert.ok(
    contents.includes("Available from"),
    "expected available from field in the left group"
  );
  assert.ok(
    contents.includes("Rent period"),
    "expected rent period field in the right group"
  );
});
