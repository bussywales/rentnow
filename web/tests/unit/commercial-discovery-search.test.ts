import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property search query applies commercial discovery filters", () => {
  const sourcePath = path.join(process.cwd(), "lib", "search.ts");
  const contents = fs.readFileSync(sourcePath, "utf8");

  assert.ok(
    contents.includes('query.eq("commercial_layout_type", filters.commercialLayoutType)'),
    "expected search query to filter by commercial layout type"
  );
  assert.ok(
    contents.includes('query.gte("enclosed_rooms", filters.enclosedRoomsMin)'),
    "expected search query to filter by enclosed rooms minimum"
  );
});

void test("properties browse suppresses bedroom-only exact-match logic for commercial searches", () => {
  const sourcePath = path.join(process.cwd(), "app", "properties", "page.tsx");
  const contents = fs.readFileSync(sourcePath, "utf8");

  assert.ok(
    contents.includes("ignoreBedroomsInBrowse"),
    "expected browse page to compute a commercial/non-room bedroom guard"
  );
  assert.ok(
    contents.includes("isCommercialListingType(filters.propertyType ?? null)"),
    "expected browse page to recognize commercial listing types in discovery logic"
  );
  assert.ok(
    contents.includes("filters.commercialLayoutType"),
    "expected browse page mock filtering to honor commercial layout filters"
  );
  assert.ok(
    contents.includes("filters.enclosedRoomsMin"),
    "expected browse page mock filtering to honor enclosed room filters"
  );
});
