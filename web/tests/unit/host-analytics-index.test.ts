import test from "node:test";
import assert from "node:assert/strict";
import { buildHostAnalyticsRow } from "../../lib/admin/host-analytics-index";

void test("buildHostAnalyticsRow uses safe label fallback", () => {
  const rowWithName = buildHostAnalyticsRow(
    { id: "1234567890abcdef", role: "landlord", full_name: "Ada Lovelace", business_name: null },
    {
      listingsCount: 2,
      enquiriesCount: 1,
      viewsCount: 3,
      enquiriesAvailable: true,
      viewsAvailable: true,
      lastActivity: null,
    }
  );
  assert.equal(rowWithName.label, "Ada Lovelace");

  const rowWithBusiness = buildHostAnalyticsRow(
    { id: "1234567890abcdef", role: "agent", full_name: null, business_name: "Ada Homes" },
    {
      listingsCount: 1,
      enquiriesCount: 0,
      viewsCount: 0,
      enquiriesAvailable: true,
      viewsAvailable: true,
      lastActivity: null,
    }
  );
  assert.equal(rowWithBusiness.label, "Ada Homes");

  const rowFallback = buildHostAnalyticsRow(
    { id: "1234567890abcdef", role: "landlord", full_name: null, business_name: null },
    {
      listingsCount: 0,
      enquiriesCount: 0,
      viewsCount: 0,
      enquiriesAvailable: true,
      viewsAvailable: true,
      lastActivity: null,
    }
  );
  assert.equal(rowFallback.label, "12345678...");
});

void test("buildHostAnalyticsRow hides metrics when unavailable", () => {
  const row = buildHostAnalyticsRow(
    { id: "abcdef1234567890", role: "landlord", full_name: null, business_name: null },
    {
      listingsCount: 4,
      enquiriesCount: 2,
      viewsCount: 9,
      enquiriesAvailable: false,
      viewsAvailable: false,
      lastActivity: null,
    }
  );

  assert.equal(row.listings, 4);
  assert.equal(row.enquiries, null);
  assert.equal(row.views, null);
});
