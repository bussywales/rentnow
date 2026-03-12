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
    tableContents.includes(">Quality</th>"),
    "expected quality column header in listings table"
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
    tableContents.includes('data-testid="admin-listings-row-quality"'),
    "expected row quality cell test id"
  );
  assert.ok(
    tableContents.includes('data-testid="admin-listings-quality-filter"'),
    "expected quality filter control test id"
  );
  assert.ok(
    tableContents.includes('data-testid="admin-listings-quality-sort"'),
    "expected quality sort control test id"
  );
  assert.ok(
    tableContents.includes('data-testid="admin-listings-missing-item-filter"'),
    "expected missing-item filter control test id"
  );
  assert.ok(
    tableContents.includes("Missing cover image"),
    "expected missing cover image filter label"
  );
  assert.ok(
    tableContents.includes("Missing minimum images"),
    "expected missing minimum images filter label"
  );
  assert.ok(
    tableContents.includes("Missing description"),
    "expected missing description filter label"
  );
  assert.ok(
    tableContents.includes("Missing price"),
    "expected missing price filter label"
  );
  assert.ok(
    tableContents.includes("Missing location"),
    "expected missing location filter label"
  );
  assert.ok(
    tableContents.includes("Showing {visibleRows.length} of {rows.length} rows."),
    "expected visible rows summary text for filter/sort feedback"
  );
  assert.ok(
    tableContents.includes('className="w-[220px] px-3 py-2 text-right whitespace-nowrap"'),
    "expected fixed width actions cell classes"
  );
  assert.ok(
    tableContents.includes("admin-listings-row-demo-pill"),
    "expected demo status pill test id near actions"
  );
  assert.ok(
    tableContents.includes("onOptimisticUpdate"),
    "expected optimistic demo updates in listings table actions"
  );

  const demoTogglePath = path.join(root, "components", "admin", "AdminDemoToggleButton.tsx");
  const demoToggleContents = fs.readFileSync(demoTogglePath, "utf8");
  assert.ok(
    demoToggleContents.includes('data-testid="admin-demo-confirm-modal"'),
    "expected demo confirm modal test id"
  );
  assert.ok(
    demoToggleContents.includes('data-testid="admin-demo-confirm-body"'),
    "expected demo confirm body test id for copy wrapping guards"
  );
  assert.ok(
    demoToggleContents.includes("whitespace-normal break-words leading-relaxed"),
    "expected wrapped modal copy classes to prevent overflow"
  );
  assert.ok(
    demoToggleContents.includes("event.preventDefault();"),
    "expected demo toggle handlers to prevent default navigation"
  );
  assert.ok(
    demoToggleContents.includes("event.stopPropagation();"),
    "expected demo toggle handlers to stop row click propagation"
  );
  assert.ok(
    demoToggleContents.includes("onPointerDown={(event) => {"),
    "expected demo toggle handlers to guard pointer-down propagation"
  );
  assert.ok(
    demoToggleContents.includes("void handleConfirm();"),
    "expected confirm action to run from guarded click handler"
  );
  assert.ok(
    demoToggleContents.includes("onOptimisticUpdate?.(nextIsDemo);"),
    "expected optimistic demo update callback before API round-trip"
  );

  const featuredTogglePath = path.join(root, "components", "admin", "AdminFeaturedToggleButton.tsx");
  const featuredToggleContents = fs.readFileSync(featuredTogglePath, "utf8");
  assert.ok(
    featuredToggleContents.includes("isDemo?: boolean;"),
    "expected featured toggle to accept demo state"
  );
  assert.ok(
    featuredToggleContents.includes("featureBlockedByDemo"),
    "expected featured toggle to block demo feature attempts client-side"
  );
  assert.ok(
    featuredToggleContents.includes("Demo listings can't be featured."),
    "expected featured toggle to show explicit demo guardrail copy"
  );

  const inspectorPath = path.join(root, "components", "admin", "AdminListingInspectorPanel.tsx");
  const inspectorContents = fs.readFileSync(inspectorPath, "utf8");
  assert.ok(
    inspectorContents.includes("isDemo={isDemo}"),
    "expected listing inspector featured toggle to receive demo state"
  );
  assert.ok(
    inspectorContents.includes('data-testid="admin-inspector-listing-quality"'),
    "expected inspector listing quality section test id"
  );
  assert.ok(
    inspectorContents.includes("Completeness score and missing core details."),
    "expected inspector listing quality guidance copy"
  );
});
