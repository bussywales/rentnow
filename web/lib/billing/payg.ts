import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingBool, getAppSettingInt } from "@/lib/settings/app-settings.server";

export const DEFAULT_PAYG_LISTING_FEE_AMOUNT = 2000;
export const DEFAULT_PAYG_CURRENCY = "NGN";
export const DEFAULT_TRIAL_CREDITS_AGENT = 0;
export const DEFAULT_TRIAL_CREDITS_LANDLORD = 0;

export async function getPaygConfig() {
  const enabled = await getAppSettingBool(APP_SETTING_KEYS.paygEnabled, true);
  const amount = await getAppSettingInt(
    APP_SETTING_KEYS.paygListingFeeAmount,
    DEFAULT_PAYG_LISTING_FEE_AMOUNT
  );
  const trialAgentCredits = await getAppSettingInt(
    APP_SETTING_KEYS.trialListingCreditsAgent,
    DEFAULT_TRIAL_CREDITS_AGENT
  );
  const trialLandlordCredits = await getAppSettingInt(
    APP_SETTING_KEYS.trialListingCreditsLandlord,
    DEFAULT_TRIAL_CREDITS_LANDLORD
  );

  return {
    enabled,
    amount,
    currency: DEFAULT_PAYG_CURRENCY,
    trialAgentCredits,
    trialLandlordCredits,
  };
}
