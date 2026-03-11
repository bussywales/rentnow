import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getExploreAnalyticsSettings } from "@/lib/explore/explore-analytics-settings";

const routeLabel = "/api/analytics/explore/settings";

type ExploreAnalyticsSettingsDeps = {
  hasServerSupabaseEnv?: typeof hasServerSupabaseEnv;
  requireRole?: typeof requireRole;
  getExploreAnalyticsSettings?: typeof getExploreAnalyticsSettings;
};

export async function getExploreAnalyticsSettingsResponse(
  request: Request,
  deps: ExploreAnalyticsSettingsDeps = {}
) {
  const startTime = Date.now();
  const hasEnv = deps.hasServerSupabaseEnv ?? hasServerSupabaseEnv;
  const requireRoleFn = deps.requireRole ?? requireRole;
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

  const auth = await requireRoleFn({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant", "agent", "landlord"],
  });
  if (!auth.ok) return auth.response;

  const settings = await getSettings(auth.supabase);
  return NextResponse.json({ ok: true, settings }, { status: 200 });
}

export async function GET(request: Request) {
  return getExploreAnalyticsSettingsResponse(request);
}
