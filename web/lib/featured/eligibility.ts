import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import {
  parseAppSettingBool,
  parseAppSettingInt,
  parseAppSettingString,
} from "@/lib/settings/app-settings";
import { isFeaturedListingActive } from "@/lib/properties/featured";
import { isListingExpired } from "@/lib/properties/expiry";

export type FeaturedEligibilitySettings = {
  requestsEnabled: boolean;
  price7dMinor: number;
  price30dMinor: number;
  currency: string;
  reviewSlaDays: number;
  requiresApprovedListing: boolean;
  requiresActiveListing: boolean;
  requiresNotDemo: boolean;
  minPhotos: number;
  minDescriptionChars: number;
};

export type FeaturedEligibilityCode =
  | "featured_requests_paused"
  | "already_featured"
  | "request_pending"
  | "requires_approved_listing"
  | "requires_active_listing"
  | "requires_not_demo"
  | "min_photos"
  | "min_description_chars";

export type FeaturedEligibilityBlockingReason = {
  code: FeaturedEligibilityCode;
  label: string;
};

export type FeaturedEligibilityResult = {
  eligible: boolean;
  reasons: string[];
  blocking: FeaturedEligibilityBlockingReason[];
};

export type FeaturedSettingsRow = {
  key: string;
  value: unknown;
};

export const DEFAULT_FEATURED_ELIGIBILITY_SETTINGS: FeaturedEligibilitySettings = {
  requestsEnabled: true,
  price7dMinor: 1999,
  price30dMinor: 4999,
  currency: "NGN",
  reviewSlaDays: 2,
  requiresApprovedListing: true,
  requiresActiveListing: true,
  requiresNotDemo: true,
  minPhotos: 3,
  minDescriptionChars: 80,
};

export const FEATURED_ELIGIBILITY_SETTING_KEYS = [
  APP_SETTING_KEYS.featuredRequestsEnabled,
  APP_SETTING_KEYS.featuredPrice7dMinor,
  APP_SETTING_KEYS.featuredPrice30dMinor,
  APP_SETTING_KEYS.featuredCurrency,
  APP_SETTING_KEYS.featuredReviewSlaDays,
  APP_SETTING_KEYS.featuredRequiresApprovedListing,
  APP_SETTING_KEYS.featuredRequiresActiveListing,
  APP_SETTING_KEYS.featuredRequiresNotDemo,
  APP_SETTING_KEYS.featuredMinPhotos,
  APP_SETTING_KEYS.featuredMinDescriptionChars,
] as const;

export type FeaturedEligibilityInput = {
  status?: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
  expires_at?: string | null;
  is_demo?: boolean | null;
  is_featured?: boolean | null;
  featured_until?: string | null;
  description?: string | null;
  photo_count?: number | null;
  images?: Array<unknown> | null;
};

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const integer = Math.trunc(value);
  if (integer < min) return min;
  if (integer > max) return max;
  return integer;
}

function sanitizeCurrency(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) return DEFAULT_FEATURED_ELIGIBILITY_SETTINGS.currency;
  return normalized;
}

export function parseFeaturedEligibilitySettings(
  rows?: FeaturedSettingsRow[] | null
): FeaturedEligibilitySettings {
  const map = new Map<string, unknown>();
  for (const row of rows ?? []) {
    map.set(row.key, row.value);
  }

  const defaults = DEFAULT_FEATURED_ELIGIBILITY_SETTINGS;

  return {
    requestsEnabled: parseAppSettingBool(
      map.get(APP_SETTING_KEYS.featuredRequestsEnabled),
      defaults.requestsEnabled
    ),
    price7dMinor: clampInt(
      parseAppSettingInt(map.get(APP_SETTING_KEYS.featuredPrice7dMinor), defaults.price7dMinor),
      0,
      1_000_000
    ),
    price30dMinor: clampInt(
      parseAppSettingInt(map.get(APP_SETTING_KEYS.featuredPrice30dMinor), defaults.price30dMinor),
      0,
      1_000_000
    ),
    currency: sanitizeCurrency(
      parseAppSettingString(map.get(APP_SETTING_KEYS.featuredCurrency), defaults.currency)
    ),
    reviewSlaDays: clampInt(
      parseAppSettingInt(
        map.get(APP_SETTING_KEYS.featuredReviewSlaDays),
        defaults.reviewSlaDays
      ),
      1,
      30
    ),
    requiresApprovedListing: parseAppSettingBool(
      map.get(APP_SETTING_KEYS.featuredRequiresApprovedListing),
      defaults.requiresApprovedListing
    ),
    requiresActiveListing: parseAppSettingBool(
      map.get(APP_SETTING_KEYS.featuredRequiresActiveListing),
      defaults.requiresActiveListing
    ),
    requiresNotDemo: parseAppSettingBool(
      map.get(APP_SETTING_KEYS.featuredRequiresNotDemo),
      defaults.requiresNotDemo
    ),
    minPhotos: clampInt(
      parseAppSettingInt(map.get(APP_SETTING_KEYS.featuredMinPhotos), defaults.minPhotos),
      0,
      20
    ),
    minDescriptionChars: clampInt(
      parseAppSettingInt(
        map.get(APP_SETTING_KEYS.featuredMinDescriptionChars),
        defaults.minDescriptionChars
      ),
      0,
      5000
    ),
  };
}

function pushReason(
  list: FeaturedEligibilityBlockingReason[],
  code: FeaturedEligibilityCode,
  label: string
) {
  list.push({ code, label });
}

function getPhotoCount(input: FeaturedEligibilityInput): number {
  if (typeof input.photo_count === "number" && Number.isFinite(input.photo_count)) {
    return Math.max(0, Math.trunc(input.photo_count));
  }
  if (Array.isArray(input.images)) return input.images.length;
  return 0;
}

function getDescriptionLength(input: FeaturedEligibilityInput): number {
  return String(input.description || "").trim().length;
}

function isLiveAndActive(input: FeaturedEligibilityInput, now: Date): boolean {
  const status = String(input.status || "").trim().toLowerCase();
  if (status !== "live") return false;
  if (input.is_active !== true) return false;
  if (isListingExpired(input, now)) return false;
  return true;
}

export function getFeaturedPricing(settings: FeaturedEligibilitySettings) {
  return {
    currency: settings.currency,
    price7dMinor: settings.price7dMinor,
    price30dMinor: settings.price30dMinor,
    slaDays: settings.reviewSlaDays,
  };
}

export function formatFeaturedMinorAmount(
  amountMinor: number,
  currency: string,
  locale?: string
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function getFeaturedEligibility(
  listing: FeaturedEligibilityInput,
  settings: FeaturedEligibilitySettings,
  options: { hasPendingRequest?: boolean; now?: Date } = {}
): FeaturedEligibilityResult {
  const now = options.now ?? new Date();
  const blocking: FeaturedEligibilityBlockingReason[] = [];

  if (!settings.requestsEnabled) {
    pushReason(
      blocking,
      "featured_requests_paused",
      "Featured requests are currently paused."
    );
  }

  if (isFeaturedListingActive(listing, now)) {
    pushReason(blocking, "already_featured", "Already featured.");
  }

  if (options.hasPendingRequest) {
    pushReason(blocking, "request_pending", "Request pending.");
  }

  if (settings.requiresApprovedListing && listing.is_approved !== true) {
    pushReason(
      blocking,
      "requires_approved_listing",
      "Listing must be approved before requesting Featured."
    );
  }

  if (settings.requiresActiveListing && !isLiveAndActive(listing, now)) {
    pushReason(
      blocking,
      "requires_active_listing",
      "Listing must be live and active before requesting Featured."
    );
  }

  if (settings.requiresNotDemo && listing.is_demo) {
    pushReason(
      blocking,
      "requires_not_demo",
      "Demo listings can't request featured."
    );
  }

  const photoCount = getPhotoCount(listing);
  if (settings.minPhotos > 0 && photoCount < settings.minPhotos) {
    pushReason(
      blocking,
      "min_photos",
      `Add at least ${settings.minPhotos} photos.`
    );
  }

  const descriptionLength = getDescriptionLength(listing);
  if (settings.minDescriptionChars > 0 && descriptionLength < settings.minDescriptionChars) {
    pushReason(
      blocking,
      "min_description_chars",
      `Add at least ${settings.minDescriptionChars} description characters.`
    );
  }

  return {
    eligible: blocking.length === 0,
    reasons: blocking.map((item) => item.label),
    blocking,
  };
}
