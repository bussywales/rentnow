import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property card formats cadence with rent period", () => {
  const cardPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyCard.tsx"
  );
  const contents = fs.readFileSync(cardPath, "utf8");

  assert.ok(
    contents.includes("formatCadence(property.rental_type, property.rent_period)"),
    "expected PropertyCard to include rent_period in cadence formatting"
  );
  assert.ok(
    contents.includes("formatListingType(property.listing_type)"),
    "expected PropertyCard to include listing type formatting"
  );
  assert.ok(
    contents.includes("formatSizeLabel(property.size_value, property.size_unit)"),
    "expected PropertyCard to include size formatting"
  );
  assert.ok(
    contents.includes("buildCommercialSpaceFacts(property)"),
    "expected PropertyCard to format commercial space facts"
  );
  assert.ok(
    contents.includes("spatialModel === \"commercial\""),
    "expected PropertyCard to branch commercial listings away from bedroom chips"
  );
  assert.ok(
    contents.includes('sizeLabel ? <span key="size">{sizeLabel}</span> : null'),
    "expected PropertyCard to surface commercial floor size in the discovery facts row"
  );
});
