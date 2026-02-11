import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { parseAppSettingBool } from "@/lib/settings/app-settings";
import {
  DEFAULT_VERIFICATION_REQUIREMENTS,
  type VerificationRequirements,
} from "@/lib/trust-markers";

export type VerificationRequirementRow = {
  key: string;
  value: unknown;
};

export const VERIFICATION_REQUIREMENT_KEYS = [
  APP_SETTING_KEYS.verificationRequireEmail,
  APP_SETTING_KEYS.verificationRequirePhone,
  APP_SETTING_KEYS.verificationRequireBank,
] as const;

export function parseVerificationRequirements(
  rows?: VerificationRequirementRow[] | null
): VerificationRequirements {
  const map = new Map<string, unknown>();
  for (const row of rows ?? []) {
    map.set(row.key, row.value);
  }
  return {
    requireEmail: parseAppSettingBool(
      map.get(APP_SETTING_KEYS.verificationRequireEmail),
      DEFAULT_VERIFICATION_REQUIREMENTS.requireEmail
    ),
    requirePhone: parseAppSettingBool(
      map.get(APP_SETTING_KEYS.verificationRequirePhone),
      DEFAULT_VERIFICATION_REQUIREMENTS.requirePhone
    ),
    requireBank: parseAppSettingBool(
      map.get(APP_SETTING_KEYS.verificationRequireBank),
      DEFAULT_VERIFICATION_REQUIREMENTS.requireBank
    ),
  };
}
