"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import type { ReferralTierStatus } from "@/lib/referrals/settings";

type TreeNode = {
  userId: string;
  level: number;
  depth: number;
  joinedAt: string;
  label: string;
  status?: "pending" | "active";
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
  maxDepth: number;
  tree: Record<number, TreeNode[]>;
  recentActivity: Activity[];
};

const LEVEL_PAGE_SIZE = 8;

function formatNumber(input: number): string {
  return Number(input || 0).toLocaleString();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRewardType(input: string): string {
  return input.replace(/_/g, " ");
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
    maxDepth,
    tree,
    recentActivity,
  } = props;

  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );
  const [expandedLevels, setExpandedLevels] = useState<Record<number, boolean>>({ 1: true });
  const [visibleByLevel, setVisibleByLevel] = useState<Record<number, number>>({});

  const depth = Math.max(1, Math.min(5, Math.trunc(maxDepth || 1)));

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const levels = useMemo(() => {
    const allLevels = Array.from({ length: depth }, (_, index) => index + 1);
    return allLevels.map((level) => ({
      level,
      nodes: tree[level] ?? [],
      earned: creditsEarnedByLevel[level] ?? 0,
    }));
  }, [creditsEarnedByLevel, depth, tree]);

  const shareTargets = useMemo(() => {
    if (!referralLink) return { whatsapp: "", email: "", linkedin: "" };
    const message = `Join me on PropatyHub with my referral link: ${referralLink}`;
    return {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
      email: `mailto:?subject=${encodeURIComponent("Join me on PropatyHub")}&body=${encodeURIComponent(message)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
    };
  }, [referralLink]);

  const isEmpty = totalReferrals === 0;

  const copyLink = async () => {
    if (!referralLink || !navigator?.clipboard) {
      setToast({ message: "Unable to copy link", variant: "error" });
      return;
    }
    try {
      await navigator.clipboard.writeText(referralLink);
      setToast({ message: "Link copied", variant: "success" });
    } catch {
      setToast({ message: "Unable to copy link", variant: "error" });
    }
  };

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Referrals</h1>
          <p className="text-sm text-slate-600">
            Invite agents. Earn credits when they successfully pay for listings or subscribe.
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Your referral link</p>
              <p className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                Code: {referralCode ?? "Unavailable"}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                value={referralLink ?? ""}
                readOnly
                placeholder="Referral link unavailable right now"
                aria-label="Referral link"
              />
              <Button
                type="button"
                size="sm"
                onClick={copyLink}
                disabled={!referralLink}
                className="sm:min-w-24"
              >
                Copy
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: "WhatsApp", href: shareTargets.whatsapp },
                { label: "Email", href: shareTargets.email },
                { label: "LinkedIn", href: shareTargets.linkedin },
              ].map((item) =>
                item.href ? (
                  <a
                    key={item.label}
                    href={item.href}
                    target={item.label === "Email" ? undefined : "_blank"}
                    rel={item.label === "Email" ? undefined : "noreferrer"}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span
                    key={item.label}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-400"
                  >
                    {item.label}
                  </span>
                )
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            data-testid="referrals-metric-total"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">Total referrals</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(totalReferrals)}</p>
            <p className="text-xs text-slate-600">
              Direct: {formatNumber(directReferrals)} • Indirect: {formatNumber(indirectReferrals)}
            </p>
          </div>
          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            data-testid="referrals-metric-active"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">Active referrals</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(verifiedReferrals)}</p>
            <p className="text-xs text-slate-600">Based on verified paid events</p>
          </div>
          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            data-testid="referrals-metric-rewards"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">Rewards earned</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{creditsEarnedTotal.toFixed(2)}</p>
            <p className="text-xs text-slate-600">
              Issued: {formatNumber(creditsIssuedTotal)} • Used: {formatNumber(creditsUsedTotal)}
            </p>
          </div>
          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            data-testid="referrals-metric-tier"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">Tier</p>
            <div className="mt-2 inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-800">
              {tier.currentTier}
            </div>
            <p className="mt-2 text-xs text-slate-600">Verified referrals: {formatNumber(verifiedReferrals)}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">You&apos;re {tier.currentTier}</h2>
          <p className="text-sm text-slate-600">Tier progress is based on verified referral activity.</p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-sky-500 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, tier.progressToNext))}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-700">
            {tier.nextTier && tier.nextThreshold !== null
              ? `${verifiedReferrals} / ${tier.nextThreshold} referrals to ${tier.nextTier}`
              : "You're at the highest tier 🎉"}
          </p>
        </section>

        {isEmpty ? (
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-lg text-sky-700">
                +
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900">Invite your first agent</h2>
                <p className="text-sm text-slate-600">
                  When they publish a paid listing or subscribe, you earn rewards automatically.
                </p>
                <Button type="button" size="sm" onClick={copyLink} disabled={!referralLink}>
                  Copy referral link
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Referral tree</h2>
              <p className="text-sm text-slate-600">Showing levels 1 to {depth} based on current settings.</p>

              <div className="mt-4 space-y-3">
                {levels.map((entry) => {
                  const expanded = expandedLevels[entry.level] ?? entry.level === 1;
                  const visible = visibleByLevel[entry.level] ?? LEVEL_PAGE_SIZE;
                  const visibleNodes = entry.nodes.slice(0, visible);

                  return (
                    <div key={entry.level} className="rounded-xl border border-slate-200 bg-white p-4">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 text-left"
                        onClick={() =>
                          setExpandedLevels((current) => ({
                            ...current,
                            [entry.level]: !expanded,
                          }))
                        }
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Level {entry.level} ({entry.nodes.length})
                          </p>
                          <p className="text-xs text-slate-600">
                            Credits earned at this level: {entry.earned.toFixed(2)}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                          {expanded ? "Hide" : "Show"}
                        </span>
                      </button>

                      {expanded && (
                        <div className="mt-3 space-y-2">
                          {visibleNodes.length ? (
                            <>
                              {visibleNodes.map((node) => {
                                const status =
                                  node.status === "active"
                                    ? { label: "Active", chip: "bg-emerald-100 text-emerald-700" }
                                    : { label: "Pending", chip: "bg-amber-100 text-amber-700" };

                                return (
                                  <div
                                    key={`${entry.level}:${node.userId}:${node.joinedAt}`}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                                  >
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900">{node.label}</p>
                                      <p className="text-xs text-slate-500">Joined {formatDate(node.joinedAt)}</p>
                                    </div>
                                    <span
                                      className={cn(
                                        "rounded-full px-2 py-1 text-xs font-semibold",
                                        status.chip
                                      )}
                                    >
                                      {status.label}
                                    </span>
                                  </div>
                                );
                              })}
                              {entry.nodes.length > visibleNodes.length && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    setVisibleByLevel((current) => ({
                                      ...current,
                                      [entry.level]: visible + LEVEL_PAGE_SIZE,
                                    }))
                                  }
                                >
                                  Show more
                                </Button>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-slate-500">No referrals yet at this level.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
              <p className="text-sm text-slate-600">Last 10 referral events.</p>
              <div className="mt-4 space-y-2">
                {recentActivity.slice(0, 10).length ? (
                  recentActivity.slice(0, 10).map((item) => {
                    const isRewardEvent = item.rewardAmount > 0;
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        {isRewardEvent ? (
                          <p>
                            <span className="font-semibold text-slate-900">{item.label}</span>
                            <span className="ml-1">triggered a reward of</span>
                            <span className="ml-1 font-semibold text-slate-900">
                              {item.rewardAmount.toFixed(2)}
                            </span>
                            <span className="ml-1">{formatRewardType(item.rewardType)}</span>
                          </p>
                        ) : (
                          <p>
                            <span className="font-semibold text-slate-900">{item.label}</span>
                            <span className="ml-1">joined your referral network.</span>
                          </p>
                        )}
                        <p className="text-xs text-slate-500">
                          Level {item.level} • {formatDate(item.issuedAt)}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">
                    No activity yet — share your link to start earning.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none fixed right-4 top-20 z-50 max-w-sm">
          <Alert
            title={toast.variant === "success" ? "Done" : "Heads up"}
            description={toast.message}
            variant={toast.variant}
            onClose={() => setToast(null)}
            className="pointer-events-auto"
          />
        </div>
      )}
    </>
  );
}
