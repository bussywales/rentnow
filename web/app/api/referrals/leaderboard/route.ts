import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { getReferralSettings } from "@/lib/referrals/settings";
import { getReferralLeaderboardSnapshot, type ReferralLeaderboardWindow } from "@/lib/referrals/leaderboard.server";

const routeLabel = "/api/referrals/leaderboard";

function normalizeWindow(value: string | null): ReferralLeaderboardWindow | null {
  if (value === "month" || value === "all_time") return value;
  return null;
}

function normalizeLimit(value: string | null): number {
  const raw = Number(value || 20);
  if (!Number.isFinite(raw)) return 20;
  return Math.max(1, Math.min(50, Math.trunc(raw)));
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord", "admin"],
  });

  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const requestedWindow = normalizeWindow(url.searchParams.get("window"));
  const limit = normalizeLimit(url.searchParams.get("limit"));

  const settings = await getReferralSettings(auth.supabase);
  const snapshot = await getReferralLeaderboardSnapshot({
    userId: auth.user.id,
    tierThresholds: settings.tierThresholds,
    config: settings.leaderboard,
    topLimit: limit,
  });

  const window = requestedWindow ?? snapshot.defaultWindow;
  const selected =
    snapshot.windows.find((item) => item.window === window) ??
    snapshot.windows.find((item) => item.window === snapshot.defaultWindow) ??
    snapshot.windows[0] ??
    null;

  return NextResponse.json({
    ok: true,
    enabled: snapshot.enabled,
    publicVisible: snapshot.publicVisible,
    window: selected?.window ?? window,
    entries:
      selected?.entries.map((entry) => ({
        rank: entry.rank,
        displayName: entry.displayName,
        tier: entry.tier,
        activeReferrals: entry.activeReferrals,
        joinedAt: entry.joinedAt,
        isYou: entry.isYou,
      })) ?? [],
    myRank: selected?.myRank ?? null,
    myActiveReferrals: selected?.myActiveReferrals ?? 0,
    totalAgents: selected?.totalAgents ?? 0,
    availableWindows: snapshot.availableWindows,
    defaultWindow: snapshot.defaultWindow,
    userOptedOut: snapshot.userOptedOut,
    scope: settings.leaderboard.scope,
  });
}
