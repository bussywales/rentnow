import Link from "next/link";
import { redirect } from "next/navigation";
import ReferralTierBadge from "@/components/referrals/ReferralTierBadge";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { fetchUserRole } from "@/lib/auth/role";
import { normalizeRole } from "@/lib/roles";
import { getReferralSettings } from "@/lib/referrals/settings";
import {
  getReferralLeaderboardSnapshot,
  type ReferralLeaderboardWindow,
} from "@/lib/referrals/leaderboard.server";

export const dynamic = "force-dynamic";

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString();
}

type SearchParams = Record<string, string | string[] | undefined>;

function normalizeWindow(raw: string | string[] | undefined): ReferralLeaderboardWindow {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "all_time" ? "all_time" : "month";
}

export default async function ReferralLeaderboardPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/login?reason=auth");
  }

  const role = normalizeRole(await fetchUserRole(supabase, user.id));
  if (role === "tenant") {
    redirect("/tenant/home");
  }

  if (role !== "agent" && role !== "landlord" && role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const params = searchParams ? await searchParams : {};
  const requestedWindow = normalizeWindow(params.window);

  const settings = await getReferralSettings(supabase);
  const snapshot = await getReferralLeaderboardSnapshot({
    userId: user.id,
    tierThresholds: settings.tierThresholds,
    config: settings.leaderboard,
    topLimit: 50,
  });

  const selected =
    snapshot.windows.find((item) => item.window === requestedWindow) ??
    snapshot.windows.find((item) => item.window === snapshot.defaultWindow) ??
    snapshot.windows[0] ??
    null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-4" data-testid="referrals-leaderboard-page">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Referrals</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Top referrers</h1>
        <p className="mt-2 text-sm text-slate-600">
          Leaderboard rank is based on Active referrals only. This view never displays credits, earnings, or cash values.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {snapshot.availableWindows.map((window) => (
            <Link
              key={window}
              href={`/dashboard/referrals/leaderboard?window=${window}`}
              className={`rounded-lg border px-3 py-1.5 font-semibold ${
                selected?.window === window
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 text-slate-700"
              }`}
            >
              {window === "month" ? "This month" : "All time"}
            </Link>
          ))}
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Your rank</h2>
        <p className="mt-1 text-sm text-slate-700" data-testid="referrals-leaderboard-your-rank">
          {selected?.myRank
            ? `You're #${formatNumber(selected.myRank)} with ${formatNumber(
                selected.myActiveReferrals
              )} active referrals out of ${formatNumber(selected.totalAgents)} agents.`
            : `You're not ranked yet for this period. Active referrals counted: ${formatNumber(
                selected?.myActiveReferrals ?? 0
              )}.`}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          How to climb: Invite → referral joins → completes verified paid event.
        </p>
      </section>

      {snapshot.enabled && snapshot.publicVisible ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Leaderboard (Top 50)</h2>
          <div className="mt-3 space-y-2">
            {selected?.entries.length ? (
              selected.entries.map((entry) => (
                <div
                  key={`${selected.window}:${entry.userId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                      #{formatNumber(entry.rank)}
                    </span>
                    <p className="text-sm font-semibold text-slate-900">{entry.displayName}</p>
                    {entry.isYou ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                        You
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <ReferralTierBadge tier={entry.tier} />
                    <span className="text-xs text-slate-600">{formatNumber(entry.activeReferrals)} Active</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">No leaderboard entries available yet.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-600">
          Leaderboard visibility is currently disabled by admin.
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Next step</h2>
        <p className="mt-1 text-sm text-slate-600">
          Invite qualified peers and help them complete a verified paid event to increase Active referrals.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard/referrals" className="font-semibold text-slate-900 underline underline-offset-4">
            Invite more
          </Link>
          <Link href="/help/referrals#for-agents-hosts" className="font-semibold text-slate-900 underline underline-offset-4">
            Learn Active referral rules
          </Link>
        </div>
      </section>
    </div>
  );
}
