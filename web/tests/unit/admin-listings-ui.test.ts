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
  assert.ok(
    tableContents.includes("<colgroup>"),
    "expected colgroup for header/body alignment"
  );
  assert.ok(
    tableContents.includes('data-testid="admin-listings-header-spacer"'),
    "expected header spacer for status accent column"
  );
  assert.ok(
    tableContents.includes('data-testid="admin-listings-row-spacer"'),
    "expected row spacer for status accent column"
  );
  assert.ok(
    tableContents.includes('data-testid="admin-listings-row-price"'),
    "expected row price cell test id"
  );
  assert.ok(
    tableContents.includes("text-slate-700 tabular-nums overflow-hidden"),
    "expected price cell overflow guard classes"
  );
  assert.ok(
    tableContents.includes("inline-flex w-full min-w-0 items-center justify-end"),
    "expected constrained inline flex wrapper in price cell"
  );
  assert.ok(
    tableContents.includes('data-testid="admin-listings-row-actions"'),
    "expected row actions cell test id"
  );
  assert.ok(
    tableContents.includes('className="w-[220px] px-3 py-2 text-right whitespace-nowrap"'),
    "expected fixed width actions cell classes"
  );
});
