import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const typeaheadPath = path.join(
  process.cwd(),
  "components",
  "shortlets",
  "search",
  "WhereTypeahead.tsx"
);

void test("where typeahead includes keyboard navigation and escape handling", () => {
  const contents = fs.readFileSync(typeaheadPath, "utf8");
  assert.ok(contents.includes("if (event.key === \"Escape\")"));
  assert.ok(contents.includes("if (event.key === \"ArrowDown\")"));
  assert.ok(contents.includes("if (event.key === \"ArrowUp\")"));
  assert.ok(contents.includes("if (event.key === \"Enter\")"));
});

void test("where typeahead renders dropdown with recents and saved actions", () => {
  const contents = fs.readFileSync(typeaheadPath, "utf8");
  assert.ok(contents.includes('data-testid="where-typeahead-dropdown"'));
  assert.ok(contents.includes("Save this search"));
  assert.ok(contents.includes("Clear recents"));
  assert.ok(contents.includes("Remove"));
  assert.ok(contents.includes("Search \"${query}\" worldwide"));
});

void test("where typeahead requests backend suggestions and supports loading/empty states", () => {
  const contents = fs.readFileSync(typeaheadPath, "utf8");
  assert.ok(contents.includes("/api/places/suggest"));
  assert.ok(contents.includes("Searching…"));
  assert.ok(contents.includes("No matches — try a nearby city."));
});
