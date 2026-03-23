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
  assert.ok(
    filtersContents.includes("Sort: quality highest"),
    "expected applied filters to expose derived sort chips"
  );
  assert.ok(
    filtersContents.includes("Gap: missing cover image"),
    "expected applied filters to expose quick gap filter chips"
  );
  assert.ok(
    filtersContents.includes("Quality: needs work"),
    "expected applied filters to expose quality state chips"
  );

  const toolbarPath = path.join(root, "components", "admin", "AdminListingsFiltersClient.tsx");
  const toolbarContents = fs.readFileSync(toolbarPath, "utf8");
  assert.ok(
    toolbarContents.includes('data-testid="admin-listings-search"'),
    "expected unified search input test id"
  );
  assert.ok(
    toolbarContents.includes("Search title, listing ID, owner, or location"),
    "expected broader registry search placeholder"
  );
  assert.ok(
    toolbarContents.includes('data-testid="admin-listings-sort"'),
    "expected server-side sort control test id"
  );
  assert.ok(
    toolbarContents.includes("Default order (updated newest)"),
    "expected clearer default sort label"
  );
  assert.ok(
    toolbarContents.includes("Created: newest first"),
    "expected created newest sort option"
  );
  assert.ok(
    toolbarContents.includes("Created: oldest first"),
    "expected created oldest sort option"
  );
  assert.ok(
    toolbarContents.includes("Updated: oldest first"),
    "expected updated oldest sort option"
  );
  assert.ok(
    toolbarContents.includes("Expiry: soonest first"),
    "expected expiry sort option"
  );
  assert.ok(
    toolbarContents.includes("Quality: highest first"),
    "expected quality highest sort option"
  );
  assert.ok(
    toolbarContents.includes("Quality: lowest first"),
    "expected quality lowest sort option"
  );
  assert.ok(
    toolbarContents.includes("Title: A-Z"),
    "expected title sort option"
  );
  assert.ok(
    toolbarContents.includes("Live / approved: newest first"),
    "expected approved/live sort option"
  );
  assert.ok(
    toolbarContents.includes('data-testid="admin-listings-quality-filter"'),
    "expected quality filter in the main server-backed controls"
  );
  assert.ok(
    toolbarContents.includes('data-testid="admin-listings-missing-item-filter"'),
    "expected quick gap filter in the main server-backed controls"
  );
  assert.ok(
    toolbarContents.includes("Searches the full registry server-side across title, listing ID, owner, and location text."),
    "expected explicit server-side search guidance"
  );

  const tablePath = path.join(root, "components", "admin", "AdminListingsTable.tsx");
  const tableContents = fs.readFileSync(tablePath, "utf8");
  assert.ok(
    tableContents.includes('data-testid="admin-listings-row"'),
    "expected listings row test id"
  );
  assert.ok(
    tableContents.includes("resolveAdminOwnerIdentityDisplay"),
    "expected listings table owner column to use owner identity fallback helper"
  );
  assert.ok(
    tableContents.includes("Listing ID: {item.id}"),
    "expected listing id to remain secondary metadata in the title cell"
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
  assert.match(
    tableContents,
    />\s*View\s*<\/button>/,
    "expected primary row action to use View label"
  );
  assert.ok(
    tableContents.includes("gap-1.5"),
    "expected tighter row action spacing"
  );
  assert.ok(
    tableContents.includes("font-semibold text-slate-800"),
    "expected View action to render as the stronger primary action"
  );
  assert.ok(
    tableContents.includes('data-testid="admin-listings-row-quality"'),
    "expected row quality cell test id"
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
    featuredToggleContents.includes("listingStatus?: string | null;"),
    "expected featured toggle to accept listing status"
  );
  assert.ok(
    featuredToggleContents.includes("featureBlockedByDemo"),
    "expected featured toggle to block demo feature attempts client-side"
  );
  assert.ok(
    featuredToggleContents.includes("featureBlockedByRemoved"),
    "expected featured toggle to block removed listings client-side"
  );
  assert.ok(
    featuredToggleContents.includes("Demo listings can't be featured."),
    "expected featured toggle to show explicit demo guardrail copy"
  );
  assert.ok(
    featuredToggleContents.includes("Removed listings can't be featured."),
    "expected featured toggle to show explicit removed guardrail copy"
  );
  assert.ok(
    featuredToggleContents.includes('{nextFeatured ? "Feature" : "Unfeature"}'),
    "expected featured toggle label to be state-aware and compact"
  );

  const inspectorPath = path.join(root, "components", "admin", "AdminListingInspectorPanel.tsx");
  const inspectorContents = fs.readFileSync(inspectorPath, "utf8");
  assert.ok(
    inspectorContents.includes("isDemo={isDemo}"),
    "expected listing inspector featured toggle to receive demo state"
  );
  assert.ok(
    inspectorContents.includes("listingStatus={effectiveStatus}"),
    "expected listing inspector featured toggle to receive effective status"
  );
  assert.ok(
    inspectorContents.includes('data-testid="admin-inspector-listing-quality"'),
    "expected inspector listing quality section test id"
  );
  assert.ok(
    inspectorContents.includes("Completeness score and missing core details."),
    "expected inspector listing quality guidance copy"
  );
  const lifecyclePath = path.join(root, "components", "admin", "AdminListingLifecyclePanel.tsx");
  const lifecycleContents = fs.readFileSync(lifecyclePath, "utf8");
  assert.ok(
    lifecycleContents.includes('data-testid="admin-inspector-listing-lifecycle"'),
    "expected inspector lifecycle section test id"
  );
  assert.ok(
    lifecycleContents.includes("Marketplace removal"),
    "expected lifecycle section heading in lifecycle panel"
  );
  assert.ok(
    lifecycleContents.includes("Removed from marketplace"),
    "expected explicit removed-marketplace copy"
  );

  const demoToggleLabelCheck = fs.readFileSync(demoTogglePath, "utf8");
  assert.ok(
    demoToggleLabelCheck.includes('{nextIsDemo ? "Set demo" : "Remove demo"}'),
    "expected demo toggle label to be state-aware and compact"
  );
});
