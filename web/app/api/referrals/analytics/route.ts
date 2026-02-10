import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import {
  getReferralOwnerAnalytics,
  getReferralOwnerFunnelSnapshot,
  getReferralTrackingSettings,
  getReferralCodeForOwner,
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

  const referralCode = await getReferralCodeForOwner(auth.supabase, auth.user.id);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const funnel30d = await getReferralOwnerFunnelSnapshot({
    client: auth.supabase,
    ownerId: auth.user.id,
    referralCode,
    sinceIso: since30d,
  });

  const bestCampaign = analytics.campaigns.reduce<
    | (typeof analytics.campaigns)[number]
    | null
  >((best, current) => {
    if (!best) return current;
    if (current.activeReferrals !== best.activeReferrals) {
      return current.activeReferrals > best.activeReferrals ? current : best;
    }
    if (current.captures !== best.captures) {
      return current.captures > best.captures ? current : best;
    }
    return current.clicks > best.clicks ? current : best;
  }, null);

  return NextResponse.json({
    ok: true,
    enabled: true,
    attributionWindowDays: settings.attributionWindowDays,
    totals: analytics.totals,
    funnel30d,
    topChannel: bestCampaign
      ? {
          campaignId: bestCampaign.id,
          name: bestCampaign.name,
          channel: bestCampaign.channel,
          utm_source: bestCampaign.utm_source ?? null,
          activeReferrals: bestCampaign.activeReferrals,
        }
      : null,
    campaigns: analytics.campaigns,
  });
}
