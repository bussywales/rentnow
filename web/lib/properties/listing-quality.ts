import { orderImagesWithCover } from "@/lib/properties/images";
import { formatListingTitle } from "@/lib/ui/format-listing-title";

type ListingQualityImage = {
  id?: string | null;
  image_url?: string | null;
  position?: number | null;
  created_at?: string | null;
};

type ListingQualityVideo = {
  id?: string | null;
  video_url?: string | null;
  storage_path?: string | null;
};

type ListingQualityShortletSetting = {
  nightly_price_minor?: number | null;
};

export type ListingQualityInput = {
  title?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  featured_media?: "image" | "video" | null;
  has_video?: boolean | null;
  price?: number | null;
  currency?: string | null;
  city?: string | null;
  country?: string | null;
  country_code?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  location_place_id?: string | null;
  shortlet_nightly_price_minor?: number | null;
  shortlet_settings?: ListingQualityShortletSetting[] | null;
  images?: ListingQualityImage[] | null;
  property_images?: ListingQualityImage[] | null;
  property_videos?: ListingQualityVideo[] | null;
};

export type ListingCompletenessMissingFlag =
  | "missing_title"
  | "weak_title"
  | "missing_cover"
  | "missing_images"
  | "missing_description"
  | "missing_price"
  | "missing_location";

export type ListingCompletenessResult = {
  score: number;
  missingFlags: ListingCompletenessMissingFlag[];
  missingItems: string[];
  has_title: boolean;
  has_meaningful_title: boolean;
  has_cover_image: boolean;
  has_min_images: boolean;
  has_description: boolean;
  has_price: boolean;
  has_location: boolean;
  has_video: boolean;
};

export type ListingHeroMediaPreference = {
  mode: "image" | "video";
  source: "featured_video" | "cover_image" | "first_image" | "none";
  imageUrl: string | null;
  hasVideo: boolean;
};

const TITLE_PLACEHOLDER_PATTERNS = [
  /^title$/i,
  /^listing$/i,
  /^untitled$/i,
  /^my listing$/i,
  /^new listing$/i,
  /^test(?:\s+listing)?$/i,
  /^property$/i,
  /^apartment$/i,
  /^house$/i,
  /^home$/i,
  /^sample$/i,
];

const clampScore = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

function cleanText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isMostlyUppercase(value: string): boolean {
  const letters = value.match(/[A-Za-z]/g) ?? [];
  if (!letters.length) return false;
  const upperCount = letters.filter((char) => char === char.toUpperCase()).length;
  return upperCount / letters.length >= 0.9;
}

function isValidPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function collectImageUrls(listing: ListingQualityInput): string[] {
  const merged = [...(listing.images ?? []), ...(listing.property_images ?? [])];
  if (!merged.length) {
    const coverOnly = cleanText(listing.cover_image_url);
    return coverOnly ? [coverOnly] : [];
  }

  const normalized = merged
    .map((image, index) => ({
      id: cleanText(image.id) || `image-${index}`,
      image_url: cleanText(image.image_url),
      position: typeof image.position === "number" ? image.position : null,
      created_at: cleanText(image.created_at) || undefined,
    }))
    .filter((image) => image.image_url.length > 0);

  const ordered = orderImagesWithCover(cleanText(listing.cover_image_url) || null, normalized);
  const orderedUrls = ordered.map((image) => image.image_url);
  const coverUrl = cleanText(listing.cover_image_url);
  const seeded = coverUrl ? [coverUrl, ...orderedUrls] : orderedUrls;
  return Array.from(new Set(seeded));
}

export function normalizeListingTitleForDisplay(
  title: string | null | undefined,
  options?: { fallback?: string }
): string {
  const fallback = options?.fallback ?? "Untitled listing";
  const raw = cleanText(title);
  const formatted = formatListingTitle(raw);
  return formatted || raw || fallback;
}

export function hasMeaningfulListingTitle(title: string | null | undefined): boolean {
  const raw = cleanText(title).replace(/\s+/g, " ");
  if (!raw) return false;
  if (TITLE_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(raw))) return false;

  const lettersOnly = raw.replace(/[^A-Za-z]/g, "");
  if (lettersOnly.length < 6) return false;
  if (raw.length < 12) return false;
  if (raw.split(" ").filter(Boolean).length < 2) return false;
  if (isMostlyUppercase(raw)) return false;

  return true;
}

function resolvePriceSignal(listing: ListingQualityInput): boolean {
  const hasBasePrice = isValidPositiveNumber(listing.price);
  const hasNightlyPrice =
    isValidPositiveNumber(listing.shortlet_nightly_price_minor) ||
    Boolean(
      listing.shortlet_settings?.some((setting) =>
        isValidPositiveNumber(setting?.nightly_price_minor ?? null)
      )
    );
  const hasCurrency = cleanText(listing.currency).length > 0;
  return hasCurrency && (hasBasePrice || hasNightlyPrice);
}

function resolveLocationSignal(listing: ListingQualityInput): boolean {
  const hasCity = cleanText(listing.city).length > 0;
  const hasLabel = cleanText(listing.location_label).length > 0;
  const hasPlace = cleanText(listing.location_place_id).length > 0;
  const hasCoordinates =
    typeof listing.latitude === "number" &&
    Number.isFinite(listing.latitude) &&
    typeof listing.longitude === "number" &&
    Number.isFinite(listing.longitude);
  return hasCity || hasLabel || hasPlace || hasCoordinates;
}

export function resolveListingHasVideoSignal(listing: ListingQualityInput): boolean {
  if (listing.has_video === true) return true;
  if (listing.has_video === false) return false;

  return Boolean(
    listing.property_videos?.some((video) => {
      const url = cleanText(video.video_url);
      const path = cleanText(video.storage_path);
      return url.length > 0 || path.length > 0;
    })
  );
}

export function computeListingCompleteness(listing: ListingQualityInput): ListingCompletenessResult {
  const normalizedTitle = cleanText(listing.title);
  const imageUrls = collectImageUrls(listing);
  const hasCoverImage = cleanText(listing.cover_image_url).length > 0;
  const hasTitle = normalizedTitle.length > 0;
  const hasMeaningfulTitle = hasMeaningfulListingTitle(normalizedTitle);
  const hasMinImages = imageUrls.length >= 3;
  const hasDescription = cleanText(listing.description).length > 0;
  const hasPrice = resolvePriceSignal(listing);
  const hasLocation = resolveLocationSignal(listing);
  const hasVideo = resolveListingHasVideoSignal(listing);

  const missingFlags: ListingCompletenessMissingFlag[] = [];
  const missingItems: string[] = [];

  if (!hasTitle) {
    missingFlags.push("missing_title");
    missingItems.push("Add a listing title.");
  }
  if (!hasMeaningfulTitle) {
    missingFlags.push("weak_title");
    missingItems.push("Use a clear, specific title (not placeholder/all-caps).");
  }
  if (!hasCoverImage) {
    missingFlags.push("missing_cover");
    missingItems.push("Choose a cover image.");
  }
  if (!hasMinImages) {
    missingFlags.push("missing_images");
    missingItems.push("Add at least 3 photos.");
  }
  if (!hasDescription) {
    missingFlags.push("missing_description");
    missingItems.push("Add a description.");
  }
  if (!hasPrice) {
    missingFlags.push("missing_price");
    missingItems.push("Set a valid price and currency.");
  }
  if (!hasLocation) {
    missingFlags.push("missing_location");
    missingItems.push("Add a location (city, pin, or coordinates).");
  }

  const score = clampScore(
    (hasTitle ? 15 : 0) +
      (hasMeaningfulTitle ? 15 : 0) +
      (hasCoverImage ? 15 : 0) +
      (hasMinImages ? 20 : 0) +
      (hasDescription ? 15 : 0) +
      (hasPrice ? 10 : 0) +
      (hasLocation ? 10 : 0)
  );

  return {
    score,
    missingFlags,
    missingItems,
    has_title: hasTitle,
    has_meaningful_title: hasMeaningfulTitle,
    has_cover_image: hasCoverImage,
    has_min_images: hasMinImages,
    has_description: hasDescription,
    has_price: hasPrice,
    has_location: hasLocation,
    has_video: hasVideo,
  };
}

export function resolveListingHeroMediaPreference(
  listing: ListingQualityInput
): ListingHeroMediaPreference {
  const hasVideo = resolveListingHasVideoSignal(listing);
  const preferredVideo = listing.featured_media === "video";
  const imageUrls = collectImageUrls(listing);
  const coverImageUrl = cleanText(listing.cover_image_url);
  const firstImageUrl = imageUrls[0] ?? null;

  if (preferredVideo && hasVideo) {
    return {
      mode: "video",
      source: "featured_video",
      imageUrl: coverImageUrl || firstImageUrl,
      hasVideo,
    };
  }

  if (coverImageUrl) {
    return {
      mode: "image",
      source: "cover_image",
      imageUrl: coverImageUrl,
      hasVideo,
    };
  }

  if (firstImageUrl) {
    return {
      mode: "image",
      source: "first_image",
      imageUrl: firstImageUrl,
      hasVideo,
    };
  }

  return {
    mode: "image",
    source: "none",
    imageUrl: null,
    hasVideo,
  };
}
