import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("CurrencySelect renders a searchable dropdown with pinned options", () => {
  const componentPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "CurrencySelect.tsx"
  );
  const contents = fs.readFileSync(componentPath, "utf8");

  assert.ok(
    contents.includes("All currencies"),
    "expected dropdown to render the all currencies section"
  );
  assert.ok(
    contents.includes("Top"),
    "expected dropdown to render the top currencies section"
  );
  assert.ok(
    contents.includes("Search currencies"),
    "expected dropdown to include a search input"
  );
  assert.ok(
    contents.includes("queryLower"),
    "expected search filtering to use queryLower"
  );
  assert.ok(
    contents.includes("includes(queryLower)"),
    "expected search filtering to match queryLower"
  );
  assert.ok(
    contents.includes("handleSelect(option.code)"),
    "expected selecting an option to use handleSelect"
  );
  assert.ok(
    contents.includes("topOptions.length + index"),
    "expected all currencies list to render after pinned options"
  );
});
