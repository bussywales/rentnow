import { computeLocationQuality } from "./location-quality";
import type { Property, PropertyImage } from "@/lib/types";

export type ReadinessIssueAction = "location" | "photos" | "details";

export type ReadinessIssueCode =
  | "LOCATION_MEDIUM"
  | "LOCATION_WEAK"
  | "NO_PHOTOS"
  | "LOW_PHOTO_COUNT"
  | "NO_COVER"
  | "WEAK_COVER"
  | "RECOMMENDED_COVER";

export type ReadinessResult = {
  score: number;
  tier: "Excellent" | "Good" | "Needs work";
  issues: { key: string; code: ReadinessIssueCode; label: string; action?: ReadinessIssueAction }[];
};

type ReadinessInput = Property & {
  images?: PropertyImage[] | null;
  recommended_cover_url?: string | null;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

export function computeListingReadiness(property: ReadinessInput): ReadinessResult {
  let score = 100;
  const issues: ReadinessResult["issues"] = [];
  const locationQuality = computeLocationQuality({
    latitude: property.latitude ?? null,
    longitude: property.longitude ?? null,
    location_label: property.location_label ?? null,
    location_place_id: property.location_place_id ?? null,
    country_code: property.country_code ?? null,
    admin_area_1: property.admin_area_1 ?? property.state_region ?? null,
    admin_area_2: property.admin_area_2 ?? null,
    postal_code: property.postal_code ?? null,
    city: property.city ?? null,
  });

  if (locationQuality.quality === "medium") {
    score -= 10;
    issues.push({
      key: "location_medium",
      code: "LOCATION_MEDIUM",
      label: "Location could be clearer (add region/postcode).",
      action: "location",
    });
  } else if (locationQuality.quality === "weak") {
    score -= 20;
    issues.push({
      key: "location_weak",
      code: "LOCATION_WEAK",
      label: "Pin location and add region/postcode.",
      action: "location",
    });
  }

  const images = property.images || [];
  const photoCount = images.length;
  const coverUrl = property.cover_image_url ?? null;

  if (photoCount === 0) {
    score -= 40;
    issues.push({
      key: "no_photos",
      code: "NO_PHOTOS",
      label: "Add photos (cover + gallery).",
      action: "photos",
    });
  } else if (photoCount < 5) {
    score -= 15;
    issues.push({
      key: "few_photos",
      code: "LOW_PHOTO_COUNT",
      label: "Add more photos (aim for 5+).",
      action: "photos",
    });
  }

  if (!coverUrl) {
    score -= 10;
    issues.push({
      key: "no_cover",
      code: "NO_COVER",
      label: "Set a cover photo.",
      action: "photos",
    });
  } else {
    const coverMeta = images.find((img) => img.image_url === coverUrl);
    if (coverMeta?.width && coverMeta?.height) {
      const isPortrait = coverMeta.height > coverMeta.width;
      const isSmall = coverMeta.width < 1600 || coverMeta.height < 900;
      if (isPortrait || isSmall) {
        score -= 5;
        issues.push({
          key: "weak_cover",
          code: "WEAK_COVER",
          label: "Cover looks better as 1600×900+ landscape.",
          action: "photos",
        });
      }
    }
    if (
      property.recommended_cover_url &&
      property.recommended_cover_url !== coverUrl
    ) {
      score -= 5;
      issues.push({
        key: "recommended_cover",
        code: "RECOMMENDED_COVER",
        label: "Apply the recommended cover.",
        action: "photos",
      });
    }
  }

  const finalScore = clamp(score);
  let tier: ReadinessResult["tier"] = "Excellent";
  if (finalScore < 70) {
    tier = "Needs work";
  } else if (finalScore < 85) {
    tier = "Good";
  }

  return {
    score: finalScore,
    tier,
    issues: issues.slice(0, 3),
  };
}
