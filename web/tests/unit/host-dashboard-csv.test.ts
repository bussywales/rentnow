import test from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "@/lib/host/bulk-triage";
import type { DashboardListing } from "@/lib/properties/host-dashboard";

const baseListing: DashboardListing = {
  id: "id",
  owner_id: "owner",
  title: "Title",
  city: "City",
  rental_type: "long_term",
  price: 100,
  currency: "USD",
  bedrooms: 1,
  bathrooms: 1,
  furnished: false,
  readiness: { score: 90, tier: "Excellent", issues: [] },
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-02T00:00:00.000Z",
};

void test("exports CSV with headers and rows", () => {
  const listings: DashboardListing[] = [
    {
      ...baseListing,
      id: "a",
      title: "Nice, \"Cozy\" Place",
      readiness: { score: 80, tier: "Good", issues: [{ key: "low_photos", code: "LOW_PHOTO_COUNT", label: "Add more photos" }] },
    },
    {
      ...baseListing,
      id: "b",
      title: "Plain",
      readiness: { score: 70, tier: "Needs work", issues: [{ key: "loc", code: "LOCATION_WEAK", label: "Pin area" }] },
    },
  ];

  const csv = toCsv(listings);
  const lines = csv.split("\n");
  assert.equal(lines[0], "listing_id,title,status,readiness_score,readiness_tier,top_issue_code,top_issue_label,last_updated_iso");
  assert.ok(lines[1].includes("\"Nice, \"\"Cozy\"\" Place\""));
  assert.ok(lines[1].includes("LOW_PHOTO_COUNT"));
  assert.ok(lines[2].includes("LOCATION_WEAK"));
});
