import test from "node:test";
import assert from "node:assert/strict";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import { applyAdminListingsQualityView } from "@/lib/admin/admin-listings-quality-view";

function makeRow(
  id: string,
  options?: {
    score?: number | null;
    status?: AdminReviewListItem["listingQualityStatus"] | null;
    quality?: Partial<NonNullable<AdminReviewListItem["listingQuality"]>> | null;
  }
): AdminReviewListItem {
  const score = options?.score;
  const qualityOverrides = options?.quality ?? {};
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
            missingFlags: qualityOverrides.missingFlags ?? [],
            missingItems: qualityOverrides.missingItems ?? [],
            has_title: qualityOverrides.has_title ?? true,
            has_meaningful_title: qualityOverrides.has_meaningful_title ?? true,
            has_cover_image: qualityOverrides.has_cover_image ?? true,
            has_min_images: qualityOverrides.has_min_images ?? true,
            has_description: qualityOverrides.has_description ?? true,
            has_price: qualityOverrides.has_price ?? true,
            has_location: qualityOverrides.has_location ?? true,
            has_video: qualityOverrides.has_video ?? false,
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
    applyAdminListingsQualityView(rows, {
      filter: "strong",
      missingItemFilter: "all",
      sort: "default",
    }).map((row) => row.id),
    ["strong", "derived-strong"]
  );
  assert.deepEqual(
    applyAdminListingsQualityView(rows, {
      filter: "fair",
      missingItemFilter: "all",
      sort: "default",
    }).map((row) => row.id),
    ["fair"]
  );
  assert.deepEqual(
    applyAdminListingsQualityView(rows, {
      filter: "needs_work",
      missingItemFilter: "all",
      sort: "default",
    }).map((row) => row.id),
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
    applyAdminListingsQualityView(rows, {
      filter: "all",
      missingItemFilter: "all",
      sort: "score_desc",
    }).map((row) => row.id),
    ["a", "b", "c", "d"]
  );
  assert.deepEqual(
    applyAdminListingsQualityView(rows, {
      filter: "all",
      missingItemFilter: "all",
      sort: "score_asc",
    }).map((row) => row.id),
    ["c", "b", "a", "d"]
  );
});

void test("filters listings by each missing-item signal", () => {
  const rows = [
    makeRow("cover", {
      score: 45,
      status: "Needs work",
      quality: { has_cover_image: false, missingFlags: ["missing_cover"] },
    }),
    makeRow("images", {
      score: 55,
      status: "Needs work",
      quality: { has_min_images: false, missingFlags: ["missing_images"] },
    }),
    makeRow("description", {
      score: 62,
      status: "Fair",
      quality: { has_description: false, missingFlags: ["missing_description"] },
    }),
    makeRow("price", {
      score: 58,
      status: "Needs work",
      quality: { has_price: false, missingFlags: ["missing_price"] },
    }),
    makeRow("location", {
      score: 52,
      status: "Needs work",
      quality: { has_location: false, missingFlags: ["missing_location"] },
    }),
    makeRow("complete", { score: 91, status: "Strong" }),
  ];

  assert.deepEqual(
    applyAdminListingsQualityView(rows, {
      filter: "all",
      missingItemFilter: "missing_cover",
      sort: "default",
    }).map((row) => row.id),
    ["cover"]
  );
  assert.deepEqual(
    applyAdminListingsQualityView(rows, {
      filter: "all",
      missingItemFilter: "missing_images",
      sort: "default",
    }).map((row) => row.id),
    ["images"]
  );
  assert.deepEqual(
    applyAdminListingsQualityView(rows, {
      filter: "all",
      missingItemFilter: "missing_description",
      sort: "default",
    }).map((row) => row.id),
    ["description"]
  );
  assert.deepEqual(
    applyAdminListingsQualityView(rows, {
      filter: "all",
      missingItemFilter: "missing_price",
      sort: "default",
    }).map((row) => row.id),
    ["price"]
  );
  assert.deepEqual(
    applyAdminListingsQualityView(rows, {
      filter: "all",
      missingItemFilter: "missing_location",
      sort: "default",
    }).map((row) => row.id),
    ["location"]
  );
});

void test("missing-item filters combine with quality status filter and preserve sorting", () => {
  const rows = [
    makeRow("cover-low", {
      score: 25,
      status: "Needs work",
      quality: { has_cover_image: false, missingFlags: ["missing_cover"] },
    }),
    makeRow("cover-mid", {
      score: 49,
      status: "Needs work",
      quality: { has_cover_image: false, missingFlags: ["missing_cover"] },
    }),
    makeRow("cover-fair", {
      score: 61,
      status: "Fair",
      quality: { has_cover_image: false, missingFlags: ["missing_cover"] },
    }),
    makeRow("description-low", {
      score: 30,
      status: "Needs work",
      quality: { has_description: false, missingFlags: ["missing_description"] },
    }),
  ];

  assert.deepEqual(
    applyAdminListingsQualityView(rows, {
      filter: "needs_work",
      missingItemFilter: "missing_cover",
      sort: "score_desc",
    }).map((row) => row.id),
    ["cover-mid", "cover-low"]
  );
});
