export const SHORTLET_PUBLIC_REVIEW_DIRECTION = "guest_to_host" as const;

export type ShortletPublicReviewDirection = typeof SHORTLET_PUBLIC_REVIEW_DIRECTION;

export type PublicShortletStayReview = {
  id: string;
  bookingId: string;
  propertyId: string;
  hostUserId: string;
  rating: number;
  body: string;
  createdAt: string;
  stayDateLabel: string | null;
  propertyTitle: string | null;
  publicResponse: string | null;
  publicResponseUpdatedAt: string | null;
};

export type HostReviewSummary = {
  averageRating: number | null;
  reviewCount: number;
  recommendRate: number | null;
};

export function clampReviewRating(value: number) {
  const rating = Math.trunc(value);
  if (!Number.isFinite(rating)) return null;
  if (rating < 1 || rating > 5) return null;
  return rating;
}

export function canGuestLeaveCompletedStayReview(input: {
  bookingStatus: string | null | undefined;
  viewerIsGuest: boolean;
  existingReviewId?: string | null;
}) {
  return (
    input.viewerIsGuest &&
    input.bookingStatus === "completed" &&
    !input.existingReviewId
  );
}

export function buildHostReviewSummary(reviews: PublicShortletStayReview[]): HostReviewSummary {
  if (!reviews.length) {
    return {
      averageRating: null,
      reviewCount: 0,
      recommendRate: null,
    };
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  const recommendCount = reviews.filter((review) => review.rating >= 4).length;

  return {
    averageRating: Math.round((total / reviews.length) * 10) / 10,
    reviewCount: reviews.length,
    recommendRate: Math.round((recommendCount / reviews.length) * 100),
  };
}

export function formatStayMonth(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });
}
