import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SOURCES = [
  "components/host/HostFeaturedStrip.tsx",
  "components/host/HostListingsMasonryGrid.tsx",
  "components/host/HostListingsRail.tsx",
  "components/host/HostDashboardContent.tsx",
  "components/host/HostPropertiesManager.tsx",
  "components/host/HostShortletConversionCard.tsx",
  "app/host/performance/page.tsx",
  "lib/properties/host-dashboard.ts",
];

void test("host listing-management surfaces avoid legacy /dashboard/property edit URLs", () => {
  const legacyEditHrefPattern = /\/dashboard\/properties\/\$\{/;
  const legacyAvailabilityPattern = /\/host\/shortlets\/blocks\?property_id=/;

  for (const relativePath of SOURCES) {
    const absolutePath = path.join(process.cwd(), relativePath);
    const source = fs.readFileSync(absolutePath, "utf8");
    assert.doesNotMatch(
      source,
      legacyEditHrefPattern,
      `expected ${relativePath} to avoid legacy /dashboard/properties/:id edit href`
    );
    assert.doesNotMatch(
      source,
      legacyAvailabilityPattern,
      `expected ${relativePath} to use canonical /host/properties/[id]/availability route`
    );
  }
});
