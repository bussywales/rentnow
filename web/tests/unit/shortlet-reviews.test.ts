import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHostReviewSummary,
  canGuestLeaveCompletedStayReview,
  clampReviewRating,
  formatStayMonth,
  type PublicShortletStayReview,
} from "@/lib/shortlet/reviews";

function buildReview(partial: Partial<PublicShortletStayReview>): PublicShortletStayReview {
  return {
    id: "review-1",
    bookingId: "booking-1",
    propertyId: "property-1",
    hostUserId: "host-1",
    rating: 5,
    body: "Very responsive host and the stay matched the listing details.",
    createdAt: "2026-03-19T10:00:00.000Z",
    stayDateLabel: "Mar 2026",
    propertyTitle: "Shortlet",
    publicResponse: null,
    publicResponseUpdatedAt: null,
    ...partial,
  };
}

void test("completed-stay review eligibility only opens for completed guest bookings without a review", () => {
  assert.equal(
    canGuestLeaveCompletedStayReview({
      bookingStatus: "completed",
      viewerIsGuest: true,
      existingReviewId: null,
    }),
    true
  );
  assert.equal(
    canGuestLeaveCompletedStayReview({
      bookingStatus: "confirmed",
      viewerIsGuest: true,
      existingReviewId: null,
    }),
    false
  );
  assert.equal(
    canGuestLeaveCompletedStayReview({
      bookingStatus: "completed",
      viewerIsGuest: false,
      existingReviewId: null,
    }),
    false
  );
  assert.equal(
    canGuestLeaveCompletedStayReview({
      bookingStatus: "completed",
      viewerIsGuest: true,
      existingReviewId: "review-1",
    }),
    false
  );
});

void test("host review summary aggregates average rating and recommend rate", () => {
  const summary = buildHostReviewSummary([
    buildReview({ id: "r1", rating: 5 }),
    buildReview({ id: "r2", rating: 4 }),
    buildReview({ id: "r3", rating: 2 }),
  ]);

  assert.deepEqual(summary, {
    averageRating: 3.7,
    reviewCount: 3,
    recommendRate: 67,
  });
});

void test("review helpers clamp invalid values and format stay months defensively", () => {
  assert.equal(clampReviewRating(5.9), 5);
  assert.equal(clampReviewRating(0), null);
  assert.equal(formatStayMonth("2026-03-19T10:00:00.000Z"), "Mar 2026");
  assert.equal(formatStayMonth("bad-date"), null);
});
