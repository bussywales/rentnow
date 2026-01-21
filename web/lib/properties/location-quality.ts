import { hasPinnedLocation } from "@/lib/properties/validation";

export type LocationQuality = "strong" | "medium" | "weak";

type LocationInput = {
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  location_place_id?: string | null;
  country_code?: string | null;
  admin_area_1?: string | null;
  admin_area_2?: string | null;
  postal_code?: string | null;
  city?: string | null;
};

const PIN_HINT = "Pin an area using “Search for an area”.";
const STATE_HINT = "Add a state/region (e.g., Lagos, California, Ontario).";
const COUNTY_HINT = "Add a county/district/LGA (optional but helpful).";
const POSTAL_HINT = "Add a postal code (optional but improves matching).";

const hasValue = (value?: string | null) => typeof value === "string" && value.trim().length > 0;

export function computeLocationQuality(
  input: LocationInput
): { quality: LocationQuality; missing: string[] } {
  const pinned = hasPinnedLocation({
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    location_label: input.location_label ?? null,
    location_place_id: input.location_place_id ?? null,
  });
  const hasCountry = hasValue(input.country_code);
  const hasAdminArea1 = hasValue(input.admin_area_1);
  const hasAdminArea2 = hasValue(input.admin_area_2);
  const hasPostal = hasValue(input.postal_code);
  const hasCity = hasValue(input.city);

  let quality: LocationQuality = "weak";
  if (pinned && hasCountry && hasAdminArea1 && (hasPostal || hasAdminArea2)) {
    quality = "strong";
  } else if (pinned && hasCountry && (hasAdminArea1 || hasCity)) {
    quality = "medium";
  }

  const missing: string[] = [];
  if (quality !== "strong") {
    if (!pinned) missing.push(PIN_HINT);
    if (!hasAdminArea1) missing.push(STATE_HINT);
    if (!hasAdminArea2) missing.push(COUNTY_HINT);
    if (!hasPostal) missing.push(POSTAL_HINT);
  }

  return { quality, missing };
}
