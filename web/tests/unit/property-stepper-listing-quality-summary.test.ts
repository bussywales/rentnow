import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property stepper renders listing quality summary with incomplete and complete states", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const source = fs.readFileSync(stepperPath, "utf8");

  assert.match(source, /computeListingCompleteness/);
  assert.match(source, /data-testid="listing-quality-summary"/);
  assert.match(source, /Listing quality/);
  assert.match(source, /listingCompleteness\.score/);
  assert.match(source, /listingCompleteness\.missingItems\.slice\(0, 5\)/);
  assert.match(source, /listingQualityMissingItems\.length > 0/);
  assert.match(source, /Core listing details are complete and ready for review\./);
});
