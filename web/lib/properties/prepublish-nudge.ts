import type { LocationQuality } from "./location-quality";

export type PrePublishNudgeAction = "location" | "photos";

export type PrePublishNudgeItem = {
  id: "location" | "photos";
  status: string;
  description: string;
  action?: PrePublishNudgeAction;
};

export function buildPrePublishNudges(params: {
  locationQuality: { quality: LocationQuality };
  photoCount: number;
  coverImageUrl: string | null;
  coverWarning?: { tooSmall?: boolean; portrait?: boolean };
  recommendedCoverUrl?: string | null;
  recommendedDismissed?: boolean;
}): PrePublishNudgeItem[] {
  const nudges: PrePublishNudgeItem[] = [];
  const {
    locationQuality,
    photoCount,
    coverImageUrl,
    coverWarning,
    recommendedCoverUrl,
    recommendedDismissed,
  } = params;

  if (locationQuality.quality === "medium" || locationQuality.quality === "weak") {
    nudges.push({
      id: "location",
      status: `Location: ${locationQuality.quality === "medium" ? "Medium" : "Needs attention"}`,
      description:
        locationQuality.quality === "medium"
          ? "Add one more detail (county/postcode) for better placement."
          : "Pin an area and add region/postcode to improve search placement.",
      action: "location",
    });
  }

  const photoIssues: string[] = [];
  if (!coverImageUrl) {
    photoIssues.push("Pick a cover photo.");
  } else if (coverWarning?.tooSmall || coverWarning?.portrait) {
    photoIssues.push("Cover looks best at 1600×900+ landscape.");
  }
  if (photoCount < 5) {
    photoIssues.push("Add a few more photos (aim for 5+).");
  }
  if (
    recommendedCoverUrl &&
    !recommendedDismissed &&
    recommendedCoverUrl !== coverImageUrl
  ) {
    photoIssues.push("Apply the recommended cover for best fit.");
  }

  if (photoIssues.length > 0) {
    nudges.push({
      id: "photos",
      status: `Photos: ${photoCount || 0} added`,
      description: photoIssues.join(" "),
      action: "photos",
    });
  }

  return nudges;
}
