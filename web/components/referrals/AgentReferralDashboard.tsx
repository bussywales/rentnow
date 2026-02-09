"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ReferralTierStatus } from "@/lib/referrals/settings";

type TreeNode = {
  userId: string;
  level: number;
  depth: number;
  joinedAt: string;
  label: string;
};

type Activity = {
  id: string;
  referredUserId: string;
  level: number;
  rewardType: string;
  rewardAmount: number;
  issuedAt: string;
  label: string;
  eventType: string;
};

type Props = {
  referralCode: string | null;
  referralLink: string | null;
  totalReferrals: number;
  directReferrals: number;
  indirectReferrals: number;
  verifiedReferrals: number;
  creditsEarnedTotal: number;
  creditsIssuedTotal: number;
  creditsUsedTotal: number;
  creditsEarnedByLevel: Record<number, number>;
  tier: ReferralTierStatus;
  tree: Record<number, TreeNode[]>;
  recentActivity: Activity[];
};

function formatNumber(input: number): string {
  return Number(input || 0).toLocaleString();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function AgentReferralDashboard(props: Props) {
  const {
    referralCode,
    referralLink,
    totalReferrals,
    directReferrals,
    indirectReferrals,
    verifiedReferrals,
    creditsEarnedTotal,
    creditsIssuedTotal,
    creditsUsedTotal,
    creditsEarnedByLevel,
    tier,
    tree,
    recentActivity,
  } = props;

  const [copied, setCopied] = useState(false);

  const levels = useMemo(() => {
    const allLevels = [1, 2, 3, 4, 5] as const;
    return allLevels.map((level) => ({
      level,
      nodes: tree[level] ?? [],
      earned: creditsEarnedByLevel[level] ?? 0,
    }));
  }, [tree, creditsEarnedByLevel]);

  const copyLink = async () => {
    if (!referralLink || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Referral program</h1>
        <p className="text-sm text-slate-600">
          Invite agents and earn platform credits when their paid events are verified.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Referral code</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{referralCode ?? "Unavailable"}</p>
            {referralLink ? (
              <p className="mt-1 break-all text-xs text-slate-600">{referralLink}</p>
            ) : (
              <p className="mt-1 text-xs text-amber-700">
                Referral links are temporarily unavailable. Please refresh in a moment.
              </p>
            )}
            <div className="mt-3">
              <Button size="sm" onClick={copyLink} disabled={!referralLink}>
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current tier</p>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                {tier.currentTier}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Verified referrals: <span className="font-semibold text-slate-900">{verifiedReferrals}</span>
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-cyan-500"
                style={{ width: `${Math.max(0, Math.min(100, tier.progressToNext))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {tier.nextTier
                ? `${tier.progressToNext}% to ${tier.nextTier} (${verifiedReferrals}/${tier.nextThreshold})`
                : "Top tier reached"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total referrals</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(totalReferrals)}</p>
          <p className="text-xs text-slate-600">Direct + indirect</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Direct vs indirect</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatNumber(directReferrals)} / {formatNumber(indirectReferrals)}
          </p>
          <p className="text-xs text-slate-600">L1 / L2-L5</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Credits earned</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{creditsEarnedTotal.toFixed(2)}</p>
          <p className="text-xs text-slate-600">Across all rewarded levels</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Credits used</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatNumber(creditsUsedTotal)} / {formatNumber(creditsIssuedTotal)}
          </p>
          <p className="text-xs text-slate-600">Used / issued</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Referral hierarchy</h2>
        <p className="text-sm text-slate-600">Level 1 is expanded by default. Levels 2-5 are collapsible.</p>

        <div className="mt-4 space-y-3">
          {levels.map((entry) => {
            const content = (
              <div className="space-y-2">
                <p className="text-xs text-slate-600">Credits earned at this level: {entry.earned.toFixed(2)}</p>
                {entry.nodes.length ? (
                  <ul className="space-y-1">
                    {entry.nodes.map((node) => (
                      <li
                        key={node.userId}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        <span className="font-semibold text-slate-900">{node.label}</span>
                        <span className="ml-2 text-xs text-slate-500">Joined {formatDate(node.joinedAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No referrals yet at this level.</p>
                )}
              </div>
            );

            if (entry.level === 1) {
              return (
                <div key={entry.level} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Level {entry.level}</p>
                  {content}
                </div>
              );
            }

            return (
              <details key={entry.level} className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                  Level {entry.level} ({entry.nodes.length})
                </summary>
                <div className="mt-3">{content}</div>
              </details>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
        <p className="text-sm text-slate-600">Latest verified paid events and rewards.</p>

        <div className="mt-4 space-y-2">
          {recentActivity.length ? (
            recentActivity.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <span className="font-semibold text-slate-900">{item.label}</span>
                <span className="ml-1">activated and earned you</span>
                <span className="ml-1 font-semibold text-slate-900">{item.rewardAmount.toFixed(2)}</span>
                <span className="ml-1">{item.rewardType.replace(/_/g, " ")}</span>
                <span className="ml-2 text-xs text-slate-500">
                  L{item.level} • {formatDate(item.issuedAt)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No reward activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
