import {
  includeDemoListingsForViewer,
  normalizeDemoListingsVisibilityPolicy,
  type DemoListingsVisibilityPolicy,
} from "@/lib/properties/demo";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingString } from "@/lib/settings/app-settings.server";
import type { UserRole } from "@/lib/types";

export const DEFAULT_DEMO_LISTINGS_VISIBILITY_POLICY: DemoListingsVisibilityPolicy =
  "restricted";

export async function getDemoListingsVisibilityPolicy(): Promise<DemoListingsVisibilityPolicy> {
  const rawValue = await getAppSettingString(
    APP_SETTING_KEYS.demoListingsVisibilityPolicy,
    DEFAULT_DEMO_LISTINGS_VISIBILITY_POLICY
  );
  return normalizeDemoListingsVisibilityPolicy(
    rawValue,
    DEFAULT_DEMO_LISTINGS_VISIBILITY_POLICY
  );
}

type IncludeDemoFromSettingsInput = {
  viewerRole?: UserRole | null;
  viewerId?: string | null;
  ownerId?: string | null;
};

export async function includeDemoListingsForViewerFromSettings(
  input: IncludeDemoFromSettingsInput
): Promise<boolean> {
  const policy = await getDemoListingsVisibilityPolicy();
  return includeDemoListingsForViewer({ ...input, policy });
}
