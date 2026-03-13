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
  assert.match(source, /resolveListingCompletenessStatus/);
  assert.match(source, /data-testid="listing-quality-summary"/);
  assert.match(source, /data-testid="listing-quality-status"/);
  assert.match(source, /Listing quality/);
  assert.match(source, /listingCompleteness\.score/);
  assert.match(source, /listingCompleteness\.missingItems\.slice\(0, 5\)/);
  assert.match(source, /listingQualityMissingItems\.length > 0/);
  assert.match(source, /Improve your listing quality before submit\./);
  assert.match(source, /Recommended next fixes/);
  assert.match(source, /Missing: \{item\}/);
  assert.match(source, /Strong listing quality\. Core details are ready for review\./);
  assert.match(source, /testId="listing-quality-photos-hint"/);
  assert.match(source, /testId="listing-quality-basics-nudges"/);
  assert.match(source, /testId="listing-quality-location-nudges"/);
  assert.match(source, /testId="listing-quality-pricing-nudges"/);
  assert.match(source, /testId="listing-quality-details-nudges"/);
  assert.match(source, /resolveListingQualityNudges\(listingQualityInput, "basics"\)/);
  assert.match(source, /resolveListingQualityNudges\(listingQualityInput, "details"\)/);
  assert.match(source, /resolveListingQualityNudges\(listingQualityInput, "photos"\)/);
  assert.match(source, /resolveListingQualityNudges\(listingQualityInput, "pricing"\)/);
  assert.match(source, /resolveListingQualityNudges\(listingQualityInput, "location"\)/);
  assert.match(source, /Listing quality tip/);
});
