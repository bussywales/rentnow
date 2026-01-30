import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin listings UI exposes applied filter chips and row markers", () => {
  const root = process.cwd();
  const filtersPath = path.join(root, "components", "admin", "AdminListingsAppliedFiltersClient.tsx");
  const filtersContents = fs.readFileSync(filtersPath, "utf8");
  assert.ok(
    filtersContents.includes('data-testid="admin-listings-applied-filters"'),
    "expected applied filters bar test id"
  );
  assert.ok(
    filtersContents.includes('data-testid="admin-listings-filter-chip"'),
    "expected applied filter chip test id"
  );

  const tablePath = path.join(root, "components", "admin", "AdminListingsTable.tsx");
  const tableContents = fs.readFileSync(tablePath, "utf8");
  assert.ok(
    tableContents.includes('data-testid="admin-listings-row"'),
    "expected listings row test id"
  );
});
