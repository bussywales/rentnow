import { NextResponse } from "next/server";
import { hasServerSupabaseEnv, createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getExploreAnalyticsSettings } from "@/lib/explore/explore-analytics-settings";

type ExploreAnalyticsSettingsDeps = {
  hasServerSupabaseEnv?: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv?: typeof hasServiceRoleEnv;
  createServiceRoleClient?: typeof createServiceRoleClient;
  createServerSupabaseClient?: typeof createServerSupabaseClient;
  getExploreAnalyticsSettings?: typeof getExploreAnalyticsSettings;
};

export async function getExploreAnalyticsSettingsResponse(
  _request: Request,
  deps: ExploreAnalyticsSettingsDeps = {}
) {
  const hasEnv = deps.hasServerSupabaseEnv ?? hasServerSupabaseEnv;
  const hasServiceEnv = deps.hasServiceRoleEnv ?? hasServiceRoleEnv;
  const createServiceClient = deps.createServiceRoleClient ?? createServiceRoleClient;
  const createServerClient = deps.createServerSupabaseClient ?? createServerSupabaseClient;
  const getSettings = deps.getExploreAnalyticsSettings ?? getExploreAnalyticsSettings;

  if (!hasEnv()) {
    return NextResponse.json(
      {
        ok: true,
        settings: {
          enabled: false,
          consentRequired: false,
          noticeEnabled: false,
        },
      },
      { status: 200 }
    );
  }

  const supabase = hasServiceEnv() ? createServiceClient() : await createServerClient();
  const settings = await getSettings(supabase);
  return NextResponse.json({ ok: true, settings }, { status: 200 });
}

export async function GET(request: Request) {
  return getExploreAnalyticsSettingsResponse(request);
}
