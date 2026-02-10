import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import {
  getReferralOwnerAnalytics,
  getReferralTrackingSettings,
} from "@/lib/referrals/share-tracking.server";

const routeLabel = "/api/referrals/analytics";

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord", "admin"],
  });
  if (!auth.ok) return auth.response;

  const settings = await getReferralTrackingSettings(auth.supabase);
  if (!settings.enabled) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      attributionWindowDays: settings.attributionWindowDays,
      totals: { clicks: 0, captures: 0, activeReferrals: 0, earningsCredits: 0 },
      campaigns: [],
    });
  }

  const analytics = await getReferralOwnerAnalytics({
    client: auth.supabase,
    ownerId: auth.user.id,
  });

  return NextResponse.json({
    ok: true,
    enabled: true,
    attributionWindowDays: settings.attributionWindowDays,
    totals: analytics.totals,
    campaigns: analytics.campaigns,
  });
}
