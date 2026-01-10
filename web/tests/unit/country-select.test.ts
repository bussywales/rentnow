import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("country select renders pinned options and filters by name", () => {
  const componentPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "CountrySelect.tsx"
  );
  const listPath = path.join(process.cwd(), "lib", "countries.ts");

  const component = fs.readFileSync(componentPath, "utf8");
  const list = fs.readFileSync(listPath, "utf8");

  assert.ok(component.includes("All countries"), "expected dropdown list section");
  assert.ok(component.includes("Top"), "expected pinned countries section");
  assert.ok(component.includes("option.name.toLowerCase().includes"), "expected name filter");
  assert.ok(list.includes("NG"), "expected Nigeria in country list");
  assert.ok(list.includes("Nigeria"), "expected Nigeria name in country list");
  assert.ok(list.includes("United Kingdom"), "expected United Kingdom in country list");
  assert.ok(list.includes("TOP_COUNTRIES"), "expected pinned country codes");
});
