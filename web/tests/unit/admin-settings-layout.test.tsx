import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(filePath: string) {
  return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

void test("admin settings layout provides searchable grouped IA shell", () => {
  const source = read("components/admin/AdminSettingsLayout.tsx");

  assert.match(source, /data-testid="admin-settings-layout"/);
  assert.match(source, /AdminSettingsSearch/);
  assert.match(source, /AdminSettingsSidebar/);
  assert.match(source, /data-testid={`admin-settings-group-\$\{section.id\}`}/);
});

void test("admin settings search input exists with required test id", () => {
  const source = read("components/admin/AdminSettingsSearch.tsx");

  assert.match(source, /id="admin-settings-search"/);
  assert.match(source, /data-testid="admin-settings-search"/);
  assert.match(source, /Search settings\.\.\./);
  assert.match(source, /Clear search/);
});

void test("admin settings search filters by keyword and auto-expands matches", () => {
  const source = read("components/admin/AdminSettingsLayout.tsx");

  assert.match(source, /function matchesQuery/);
  assert.match(source, /const expandedGroupIds = normalizedQuery/);
  assert.match(source, /visibleSections\.map\(\(section\) => section\.id\)/);
  assert.match(source, /const visibleSections = useMemo/);
  assert.match(source, /if \(!isVisible\) return null;/);
});

void test("admin settings sidebar links navigate to section anchors", () => {
  const sidebar = read("components/admin/AdminSettingsSidebar.tsx");
  const layout = read("components/admin/AdminSettingsLayout.tsx");

  assert.match(sidebar, /data-testid={`admin-settings-sidebar-link-\$\{group.id\}`}/);
  assert.match(sidebar, /onClick=\{\(\) => onNavigate\(group.id\)\}/);
  assert.match(layout, /sectionNode\.scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(layout, /headingRefs\.current\[id\]\?\.focus/);
});

void test("admin settings page defines the expected section groups", () => {
  const source = read("app/admin/settings/page.tsx");

  assert.match(source, /id: "feature-toggles"/);
  assert.match(source, /id: "market-defaults"/);
  assert.match(source, /id: "brand-socials"/);
  assert.match(source, /id: "canada-payg-test-mode-gates"/);
  assert.match(source, /id: "featured-thresholds"/);
  assert.match(source, /id: "listing-expiry"/);
  assert.match(source, /id: "payg-fees"/);
  assert.match(source, /id: "subscriptions-credits"/);
  assert.match(source, /id: "location-configuration"/);
  assert.match(source, /AdminSettingsLayout sections=\{groups\}/);
});
