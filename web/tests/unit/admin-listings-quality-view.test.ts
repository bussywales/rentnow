import test from "node:test";
import assert from "node:assert/strict";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import { applyAdminListingsQualityView } from "@/lib/admin/admin-listings-quality-view";

function makeRow(
  id: string,
  options?: {
    score?: number | null;
    status?: AdminReviewListItem["listingQualityStatus"] | null;
  }
): AdminReviewListItem {
  const score = options?.score;
  return {
    id,
    title: `Listing ${id}`,
    hostName: "Host",
    updatedAt: "2026-03-11T10:00:00.000Z",
    readiness: { score: 100, tier: "Excellent", issues: [] },
    locationQuality: "strong",
    photoCount: 5,
    hasVideo: false,
    listingQuality:
      typeof score === "number"
        ? {
            score,
            missingFlags: [],
            missingItems: [],
            has_title: true,
            has_meaningful_title: true,
            has_cover_image: true,
            has_min_images: true,
            has_description: true,
            has_price: true,
            has_location: true,
            has_video: false,
          }
        : null,
    listingQualityStatus: options?.status ?? null,
  };
}

void test("filters listings by quality status", () => {
  const rows = [
    makeRow("strong", { score: 92, status: "Strong" }),
    makeRow("fair", { score: 70, status: "Fair" }),
    makeRow("needs", { score: 45, status: "Needs work" }),
    makeRow("unknown"),
    makeRow("derived-strong", { score: 86 }),
  ];

  assert.deepEqual(
    applyAdminListingsQualityView(rows, { filter: "strong", sort: "default" }).map((row) => row.id),
    ["strong", "derived-strong"]
  );
  assert.deepEqual(
    applyAdminListingsQualityView(rows, { filter: "fair", sort: "default" }).map((row) => row.id),
    ["fair"]
  );
  assert.deepEqual(
    applyAdminListingsQualityView(rows, { filter: "needs_work", sort: "default" }).map((row) => row.id),
    ["needs"]
  );
});

void test("sorts listings by quality score and keeps unknown scores last", () => {
  const rows = [
    makeRow("a", { score: 91, status: "Strong" }),
    makeRow("b", { score: 60, status: "Fair" }),
    makeRow("c", { score: 29, status: "Needs work" }),
    makeRow("d"),
  ];

  assert.deepEqual(
    applyAdminListingsQualityView(rows, { filter: "all", sort: "score_desc" }).map((row) => row.id),
    ["a", "b", "c", "d"]
  );
  assert.deepEqual(
    applyAdminListingsQualityView(rows, { filter: "all", sort: "score_asc" }).map((row) => row.id),
    ["c", "b", "a", "d"]
  );
});
