import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property stepper maps internal errors to friendly copy", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(
    contents.includes("resolveStepperError"),
    "expected error mapping helper"
  );
  assert.ok(
    contents.includes("Listing saves are unavailable right now"),
    "expected friendly Supabase config message"
  );
  assert.ok(
    contents.includes("Photo uploads are unavailable right now"),
    "expected friendly storage message"
  );
});
