import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host page places listing surface before checklist and trust panels", () => {
  const hostPagePath = path.join(process.cwd(), "app", "host", "page.tsx");
  const contents = fs.readFileSync(hostPagePath, "utf8");

  const dashboardIndex = contents.indexOf("<HostDashboardContent");
  const nextActionsIndex = contents.indexOf('<NextBestActionsPanel role={role} items={gettingStartedChecklist} />');
  const checklistIndex = contents.indexOf("<RoleChecklistPanel");
  const trustIndex = contents.indexOf("Trust status");

  assert.ok(dashboardIndex >= 0, "expected host dashboard content render");
  assert.ok(nextActionsIndex >= 0, "expected host next-best-actions panel render");
  assert.ok(checklistIndex >= 0, "expected host checklist panel render");
  assert.ok(trustIndex >= 0, "expected host trust panel render");
  assert.ok(dashboardIndex < nextActionsIndex, "expected listings to render before next actions");
  assert.ok(dashboardIndex < checklistIndex, "expected listings to render before checklist");
  assert.ok(dashboardIndex < trustIndex, "expected listings to render before trust panel");
});

void test("host dashboard content keeps listing controls before action-centre ops panel", () => {
  const hostDashboardPath = path.join(process.cwd(), "components", "host", "HostDashboardContent.tsx");
  const contents = fs.readFileSync(hostDashboardPath, "utf8");

  const listingControlsIndex = contents.indexOf("<HostDashboardControls");
  const actionCentreIndex = contents.indexOf("Action centre");

  assert.ok(listingControlsIndex >= 0, "expected host listing controls to exist");
  assert.ok(actionCentreIndex >= 0, "expected action centre panel to exist");
  assert.ok(
    listingControlsIndex < actionCentreIndex,
    "expected listing controls/cards to render before technical action-centre panel"
  );
});

void test("tenant home renders listing rails before checklist and saved-search technical panels", () => {
  const tenantHomePath = path.join(process.cwd(), "app", "tenant", "home", "page.tsx");
  const contents = fs.readFileSync(tenantHomePath, "utf8");

  const featuredRailIndex = contents.indexOf('data-testid="tenant-home-featured"');
  const shortletRailIndex = contents.indexOf('data-testid="tenant-home-shortlets"');
  const savedSearchSummaryIndex = contents.indexOf("New matches for your saved searches");
  const nextActionsIndex = contents.indexOf('<NextBestActionsPanel role="tenant" items={gettingStartedChecklist} />');
  const checklistIndex = contents.indexOf('title="Getting started checklist"');

  assert.ok(featuredRailIndex >= 0, "expected featured rail marker");
  assert.ok(shortletRailIndex >= 0, "expected shortlet rail marker");
  assert.ok(savedSearchSummaryIndex >= 0, "expected saved-search summary section");
  assert.ok(nextActionsIndex >= 0, "expected tenant next-best-actions section");
  assert.ok(checklistIndex >= 0, "expected tenant checklist section");
  assert.ok(featuredRailIndex < nextActionsIndex, "expected featured listings before next actions");
  assert.ok(shortletRailIndex < checklistIndex, "expected shortlet listings before checklist");
  assert.ok(featuredRailIndex < savedSearchSummaryIndex, "expected featured rail before saved-search summary");
});
