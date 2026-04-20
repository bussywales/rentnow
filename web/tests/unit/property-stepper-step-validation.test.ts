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
    contents.includes("commercial_layout_type: initialData?.commercial_layout_type ?? null"),
    "expected commercial layout type to initialize in PropertyStepper"
  );
  assert.ok(
    contents.includes("enclosed_rooms: initialData?.enclosed_rooms ?? 0"),
    "expected enclosed rooms to initialize in PropertyStepper"
  );
  assert.ok(
    contents.includes('...(isCommercialListing ? ["commercial_layout_type" as const] : [])'),
    "expected commercial listings to require layout type in step validation"
  );
  assert.ok(
    contents.includes("Describe the commercial layout instead of forcing a bedroom count."),
    "expected commercial layout helper copy"
  );
});
