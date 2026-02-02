import { getAppSettingInt } from "@/lib/settings/app-settings.server";
import { DEFAULT_LISTING_EXPIRY_DAYS, normalizeListingExpiryDays } from "@/lib/properties/expiry";

export async function getListingExpiryDays(
  fallback: number = DEFAULT_LISTING_EXPIRY_DAYS
): Promise<number> {
  const raw = await getAppSettingInt("listing_expiry_days", fallback);
  return normalizeListingExpiryDays(raw, fallback);
}
