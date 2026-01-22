import { computeListingReadiness, type ReadinessResult } from "@/lib/properties/listing-readiness";
import { computeLocationQuality } from "@/lib/properties/location-quality";
import { hasPinnedLocation } from "@/lib/properties/validation";
import { REVIEW_PUBLISH_COPY } from "@/lib/review-publish-microcopy";
import type { Property, PropertyImage } from "@/lib/types";

export type ReviewActionTarget = { step?: string; focus?: string };

export type ReviewItem = {
  code: string;
  title: string;
  body: string;
  actionLabel: string;
  actionTarget: ReviewActionTarget;
};

type ReviewFlags = {
  requireLocationPinForPublish?: boolean;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
};

export type ReviewChecklist = {
  readiness: ReadinessResult;
  blocking: ReviewItem[];
  recommended: ReviewItem[];
  canSubmit: boolean;
  primaryCta: { label: string };
  secondaryCta?: { label: string };
  dismissKey: string;
};

type ReviewListingInput = Partial<Property> & {
  images?: PropertyImage[] | null;
  recommended_cover_url?: string | null;
};

export function buildReviewAndPublishChecklist(
  listing: ReviewListingInput,
  flags: ReviewFlags = {}
): ReviewChecklist {
  const readinessInput = {
    ...listing,
    id: listing.id ?? "temp",
    owner_id: (listing as Property).owner_id ?? "review-owner",
    images: listing.images || [],
  };
  const readiness = computeListingReadiness(
    readinessInput as Parameters<typeof computeListingReadiness>[0]
  );

  const photoCount = listing.images?.length ?? 0;
  const hasCover = !!listing.cover_image_url;
  const coverIssue =
    readiness.issues.some((issue) => issue.code === "NO_COVER") ||
    readiness.issues.some((issue) => issue.code === "WEAK_COVER") ||
    readiness.issues.some((issue) => issue.code === "RECOMMENDED_COVER");

  const locationQuality = computeLocationQuality({
    latitude: listing.latitude ?? null,
    longitude: listing.longitude ?? null,
    location_label: listing.location_label ?? null,
    location_place_id: listing.location_place_id ?? null,
    country_code: listing.country_code ?? null,
    admin_area_1: listing.admin_area_1 ?? listing.state_region ?? null,
    admin_area_2: listing.admin_area_2 ?? null,
    postal_code: listing.postal_code ?? null,
    city: listing.city ?? null,
  });

  const blockers: ReviewItem[] = [];
  if (flags.requireLocationPinForPublish && !hasPinnedLocation(listing)) {
    blockers.push({
      code: "LOCATION_PIN_REQUIRED",
      title: REVIEW_PUBLISH_COPY.blockers.LOCATION_PIN_REQUIRED.title,
      body: REVIEW_PUBLISH_COPY.blockers.LOCATION_PIN_REQUIRED.body,
      actionLabel: REVIEW_PUBLISH_COPY.blockers.LOCATION_PIN_REQUIRED.actionLabel,
      actionTarget: { focus: "location" },
    });
  }

  const recommended: ReviewItem[] = [];

  if (photoCount < 5) {
    recommended.push({
      code: "PHOTOS_TOO_FEW",
      title: REVIEW_PUBLISH_COPY.recommended.PHOTOS_TOO_FEW.title,
      body: REVIEW_PUBLISH_COPY.recommended.PHOTOS_TOO_FEW.body,
      actionLabel: REVIEW_PUBLISH_COPY.recommended.PHOTOS_TOO_FEW.actionLabel,
      actionTarget: { step: "photos" },
    });
  }

  if (!hasCover || coverIssue) {
    recommended.push({
      code: "COVER_WEAK_OR_MISSING",
      title: REVIEW_PUBLISH_COPY.recommended.COVER_WEAK_OR_MISSING.title,
      body: REVIEW_PUBLISH_COPY.recommended.COVER_WEAK_OR_MISSING.body,
      actionLabel: REVIEW_PUBLISH_COPY.recommended.COVER_WEAK_OR_MISSING.actionLabel,
      actionTarget: { step: "photos" },
    });
  }

  if (locationQuality.quality === "medium" || locationQuality.quality === "weak") {
    recommended.push({
      code: "LOCATION_QUALITY_MEDIUM_OR_WEAK",
      title: REVIEW_PUBLISH_COPY.recommended.LOCATION_QUALITY_MEDIUM_OR_WEAK.title,
      body: REVIEW_PUBLISH_COPY.recommended.LOCATION_QUALITY_MEDIUM_OR_WEAK.body,
      actionLabel: REVIEW_PUBLISH_COPY.recommended.LOCATION_QUALITY_MEDIUM_OR_WEAK.actionLabel,
      actionTarget: { focus: "location" },
    });
  }

  if (listing.country_code && !listing.postal_code) {
    recommended.push({
      code: "MISSING_POSTAL",
      title: REVIEW_PUBLISH_COPY.recommended.MISSING_POSTAL.title,
      body: REVIEW_PUBLISH_COPY.recommended.MISSING_POSTAL.body,
      actionLabel: REVIEW_PUBLISH_COPY.recommended.MISSING_POSTAL.actionLabel,
      actionTarget: { focus: "location" },
    });
  }

  const dismissKey = `review_publish_${listing.id ?? "new"}`;

  return {
    readiness,
    blocking: blockers,
    recommended,
    canSubmit: blockers.length === 0,
    primaryCta: { label: flags.primaryCtaLabel || "Submit for approval" },
    secondaryCta: flags.secondaryCtaLabel ? { label: flags.secondaryCtaLabel } : undefined,
    dismissKey,
  };
}
