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
  assert.ok(
    contents.includes("Detail tips"),
    "expected details helper card to render"
  );
  assert.ok(
    contents.includes("Description & features"),
    "expected description card heading to render"
  );
});

void test("property basics step includes location inputs", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(contents.includes("Location"), "expected Location section in basics");
  assert.ok(
    contents.includes('htmlFor="country"'),
    "expected country input in basics"
  );
  assert.ok(
    contents.includes("State / Region"),
    "expected state/region input in basics"
  );
  assert.ok(contents.includes("City"), "expected city input in basics");
  assert.ok(contents.includes("Address"), "expected address input in basics");

  const countryCount = contents.match(/htmlFor="country"/g) || [];
  const regionCount = contents.match(/State \/ Region/g) || [];
  assert.equal(
    countryCount.length,
    1,
    "expected country field to appear only once"
  );
  assert.equal(
    regionCount.length,
    1,
    "expected state/region field to appear only once"
  );
});

void test("property payload normalizes location fields to null", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(
    contents.includes("country: normalizeOptionalString(form.country)"),
    "expected country to normalize to null"
  );
  assert.ok(
    contents.includes("state_region: normalizeOptionalString(form.state_region)"),
    "expected state_region to normalize to null"
  );
  assert.ok(
    contents.includes("address: normalizeOptionalString(form.address)"),
    "expected address to normalize to null"
  );
});
