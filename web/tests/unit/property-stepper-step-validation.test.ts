import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property stepper validates per-step fields only", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(contents.includes("STEP_FIELDS"), "expected STEP_FIELDS map");
  assert.ok(
    contents.includes(
      'basics: ['
    ),
    "expected basics step to only include core basics fields"
  );
  assert.ok(
    contents.includes('"shortlet_nightly_price_minor"'),
    "expected basics step to track shortlet nightly pricing field"
  );
  assert.ok(
    contents.includes("hasFieldErrorsCurrent"),
    "expected current step error filtering"
  );
  assert.ok(
    contents.includes('...(roomsRequired ? ["bedrooms" as const] : [])'),
    "expected bedroom requirement to follow listing type"
  );
  assert.ok(
    contents.includes("bedrooms: initialData?.bedrooms ?? 0"),
    "expected bedrooms to initialize to 0 when unset"
  );
  assert.ok(
    contents.includes("bathrooms: initialData?.bathrooms ?? 0"),
    "expected bathrooms to initialize to 0 when unset"
  );
  assert.ok(
    contents.includes("Commercial spaces can use 0 bedrooms."),
    "expected truthful commercial bedroom helper copy"
  );
});
