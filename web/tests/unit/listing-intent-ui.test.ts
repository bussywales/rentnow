import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("listing intent field is present in host create/edit UI", () => {
  const formPath = path.join(process.cwd(), "components", "properties", "PropertyForm.tsx");
  const stepperPath = path.join(process.cwd(), "components", "properties", "PropertyStepper.tsx");
  const form = fs.readFileSync(formPath, "utf8");
  const stepper = fs.readFileSync(stepperPath, "utf8");

  assert.ok(form.includes("listing_intent"), "expected listing_intent in PropertyForm");
  assert.ok(stepper.includes("listing_intent"), "expected listing_intent in PropertyStepper");
  assert.ok(
    stepper.includes('const initialListingIntent = normalizeListingIntent(initialData?.listing_intent) ?? "rent_lease";'),
    "expected default listing intent to use canonical rent_lease for new drafts"
  );
  assert.ok(
    stepper.includes('role="radiogroup"'),
    "expected listing intent to render as top-level segmented controls"
  );
});

void test("sale listings render the Enquire to buy CTA", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "[id]", "page.tsx");
  const page = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    page.includes("isSaleListing"),
    "expected sale intent branch in property page"
  );
  assert.ok(
    page.includes("Enquire to buy"),
    "expected Enquire to buy CTA copy in property page"
  );
});
