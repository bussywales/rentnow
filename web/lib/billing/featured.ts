import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingInt } from "@/lib/settings/app-settings.server";
import { DEFAULT_PAYG_CURRENCY } from "@/lib/billing/payg";

export const DEFAULT_PAYG_FEATURED_FEE_AMOUNT = 5000;
export const DEFAULT_FEATURED_DURATION_DAYS = 7;

export async function getFeaturedConfig() {
  const paygAmount = await getAppSettingInt(
    APP_SETTING_KEYS.paygFeaturedFeeAmount,
    DEFAULT_PAYG_FEATURED_FEE_AMOUNT
  );
  const durationDays = await getAppSettingInt(
    APP_SETTING_KEYS.featuredDurationDays,
    DEFAULT_FEATURED_DURATION_DAYS
  );

  return {
    paygAmount,
    durationDays,
    currency: DEFAULT_PAYG_CURRENCY,
  };
}
