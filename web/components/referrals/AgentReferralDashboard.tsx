"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/components/ui/cn";
import type { ReferralTierStatus } from "@/lib/referrals/settings";
import ReferralTierBadge from "@/components/referrals/ReferralTierBadge";
import type {
  ReferralLeaderboardSnapshot,
  ReferralLeaderboardWindow,
} from "@/lib/referrals/leaderboard.server";
import { computeMissingDefaultReferralCampaigns } from "@/lib/referrals/share-tracking-defaults";

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

type CashoutPolicy = {
  country_code: string;
  payouts_enabled: boolean;
  conversion_enabled: boolean;
  credit_to_cash_rate: number;
  currency: string;
  min_cashout_credits: number;
  monthly_cashout_cap_amount: number;
};

type CashoutRequest = {
  id: string;
  credits_requested: number;
  cash_amount: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "paid" | "void";
  requested_at: string;
  payout_reference: string | null;
};

type WalletSnapshot = {
  total_balance: number;
  held_credits: number;
  available_credits: number;
};

type ReferralMilestoneStatus = {
  id: string;
  name: string;
  threshold: number;
  bonusCredits: number;
  isEnabled: boolean;
  status: "locked" | "achieved" | "claimed";
  claimable: boolean;
  claimedAt: string | null;
};

type ShareAnalyticsCampaign = {
  id: string;
  name: string;
  channel: string;
  is_active: boolean;
  clicks: number;
  captures: number;
  activeReferrals: number;
  earningsCredits: number;
  conversionRate: number;
  shareLink: string;
  created_at: string;
};

type ShareAnalyticsSnapshot = {
  enabled: boolean;
  attributionWindowDays: number;
  totals: {
    clicks: number;
    captures: number;
    activeReferrals: number;
    earningsCredits: number;
  };
  funnel30d: {
    clicks: number;
    captures: number;
    activeReferrals: number;
    earningsCredits: number;
  };
  topChannel: {
    campaignId: string;
    name: string;
    channel: string;
    utm_source: string | null;
    activeReferrals: number;
  } | null;
  campaigns: ShareAnalyticsCampaign[];
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
  wallet: WalletSnapshot;
  milestonesEnabled: boolean;
  milestones: ReferralMilestoneStatus[];
  leaderboard: ReferralLeaderboardSnapshot;
  jurisdictionCountryCode: string;
  cashoutPolicy: CashoutPolicy;
  cashoutRequests: CashoutRequest[];
};

const LEVEL_PAGE_SIZE = 8;

type TreeFilter = "all" | "active" | "pending";

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

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 2,
  }).format(Math.max(0, value || 0));
}

function formatCashoutStatus(status: CashoutRequest["status"]) {
  const value = status.toLowerCase();
  if (value === "pending") return "Pending";
  if (value === "approved") return "Approved";
  if (value === "rejected") return "Rejected";
  if (value === "paid") return "Paid";
  if (value === "void") return "Voided";
  return status;
}

function formatMilestoneStatus(milestone: ReferralMilestoneStatus): string {
  if (milestone.status === "claimed") return "Claimed";
  if (milestone.claimable) return "Claimable";
  return "Locked";
}

function milestoneChipClass(milestone: ReferralMilestoneStatus) {
  if (milestone.status === "claimed") return "bg-emerald-100 text-emerald-700";
  if (milestone.claimable) return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

const SHARE_CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X" },
  { value: "sms", label: "SMS" },
  { value: "qr", label: "QR" },
  { value: "copy", label: "Copy" },
  { value: "other", label: "Other" },
] as const;

const EMPTY_SHARE_ANALYTICS: ShareAnalyticsSnapshot = {
  enabled: true,
  attributionWindowDays: 30,
  totals: { clicks: 0, captures: 0, activeReferrals: 0, earningsCredits: 0 },
  funnel30d: { clicks: 0, captures: 0, activeReferrals: 0, earningsCredits: 0 },
  topChannel: null,
  campaigns: [],
};

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
    wallet,
    milestonesEnabled,
    milestones,
    leaderboard,
    jurisdictionCountryCode,
    cashoutPolicy,
    cashoutRequests,
  } = props;

  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );
  const [walletState, setWalletState] = useState<WalletSnapshot>(wallet);
  const [cashoutHistory, setCashoutHistory] = useState<CashoutRequest[]>(cashoutRequests);
  const [cashoutCreditsInput, setCashoutCreditsInput] = useState<string>("");
  const [cashoutPending, setCashoutPending] = useState(false);
  const [cashoutError, setCashoutError] = useState<string | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<Record<number, boolean>>({ 1: true });
  const [visibleByLevel, setVisibleByLevel] = useState<Record<number, number>>({});
  const [treeFilter, setTreeFilter] = useState<TreeFilter>("all");
  const [tierState, setTierState] = useState<ReferralTierStatus>(tier);
  const [milestoneState, setMilestoneState] = useState<ReferralMilestoneStatus[]>(milestones);
  const [claimingMilestoneId, setClaimingMilestoneId] = useState<string | null>(null);
  const [selectedLeaderboardWindow, setSelectedLeaderboardWindow] =
    useState<ReferralLeaderboardWindow>(leaderboard.defaultWindow);
  const [leaderboardOptedOut, setLeaderboardOptedOut] = useState<boolean>(
    leaderboard.userOptedOut
  );
  const [leaderboardSaving, setLeaderboardSaving] = useState(false);
  const [shareAnalytics, setShareAnalytics] =
    useState<ShareAnalyticsSnapshot>(EMPTY_SHARE_ANALYTICS);
  const [shareAnalyticsLoading, setShareAnalyticsLoading] = useState(true);
  const [shareAnalyticsError, setShareAnalyticsError] = useState<string | null>(null);
  const [defaultCampaignsEnsured, setDefaultCampaignsEnsured] = useState(false);
  const [defaultCampaignsEnsuring, setDefaultCampaignsEnsuring] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    channel: "whatsapp",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    landing_path: "/auth/register",
  });
  const [campaignCreatePending, setCampaignCreatePending] = useState(false);
  const [campaignCreateError, setCampaignCreateError] = useState<string | null>(null);
  const [latestShareLink, setLatestShareLink] = useState<string | null>(null);

  const depth = Math.max(1, Math.min(5, Math.trunc(maxDepth || 1)));
  const cashoutEnabled = cashoutPolicy.payouts_enabled && cashoutPolicy.conversion_enabled;
  const isEmpty = totalReferrals === 0;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setWalletState(wallet);
  }, [wallet]);

  useEffect(() => {
    setCashoutHistory(cashoutRequests);
  }, [cashoutRequests]);

  useEffect(() => {
    setTierState(tier);
  }, [tier]);

  useEffect(() => {
    setMilestoneState(milestones);
  }, [milestones]);
  useEffect(() => {
    setSelectedLeaderboardWindow(leaderboard.defaultWindow);
    setLeaderboardOptedOut(leaderboard.userOptedOut);
  }, [leaderboard.defaultWindow, leaderboard.userOptedOut]);

  const loadShareAnalytics = async () => {
    setShareAnalyticsLoading(true);
    setShareAnalyticsError(null);
    try {
      const response = await fetch("/api/referrals/analytics", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setShareAnalyticsError(
          String(payload?.error || "Unable to load share analytics right now.")
        );
        return;
      }

      setShareAnalytics({
        enabled: Boolean(payload.enabled),
        attributionWindowDays: Math.max(
          1,
          Math.trunc(Number(payload.attributionWindowDays || 30))
        ),
        totals: {
          clicks: Math.max(0, Math.trunc(Number(payload.totals?.clicks || 0))),
          captures: Math.max(0, Math.trunc(Number(payload.totals?.captures || 0))),
          activeReferrals: Math.max(0, Math.trunc(Number(payload.totals?.activeReferrals || 0))),
          earningsCredits: Math.max(0, Number(payload.totals?.earningsCredits || 0)),
        },
        funnel30d: {
          clicks: Math.max(0, Math.trunc(Number(payload.funnel30d?.clicks || 0))),
          captures: Math.max(0, Math.trunc(Number(payload.funnel30d?.captures || 0))),
          activeReferrals: Math.max(
            0,
            Math.trunc(Number(payload.funnel30d?.activeReferrals || 0))
          ),
          earningsCredits: Math.max(0, Number(payload.funnel30d?.earningsCredits || 0)),
        },
        topChannel: payload.topChannel
          ? {
              campaignId: String(payload.topChannel.campaignId || ""),
              name: String(payload.topChannel.name || ""),
              channel: String(payload.topChannel.channel || "other"),
              utm_source:
                typeof payload.topChannel.utm_source === "string"
                  ? payload.topChannel.utm_source
                  : null,
              activeReferrals: Math.max(
                0,
                Math.trunc(Number(payload.topChannel.activeReferrals || 0))
              ),
            }
          : null,
        campaigns: Array.isArray(payload.campaigns)
          ? payload.campaigns.map((item: Record<string, unknown>) => ({
              id: String(item.id || ""),
              name: String(item.name || ""),
              channel: String(item.channel || "other"),
              is_active: Boolean(item.is_active),
              clicks: Math.max(0, Math.trunc(Number(item.clicks || 0))),
              captures: Math.max(0, Math.trunc(Number(item.captures || 0))),
              activeReferrals: Math.max(0, Math.trunc(Number(item.activeReferrals || 0))),
              earningsCredits: Math.max(0, Number(item.earningsCredits || 0)),
              conversionRate: Math.max(0, Number(item.conversionRate || 0)),
              shareLink: String(item.shareLink || ""),
              created_at: String(item.created_at || ""),
            }))
          : [],
      });
    } catch {
      setShareAnalyticsError("Unable to load share analytics right now.");
    } finally {
      setShareAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    void loadShareAnalytics();
  }, []);

  useEffect(() => {
    if (defaultCampaignsEnsured || defaultCampaignsEnsuring) return;
    if (shareAnalyticsLoading || !shareAnalytics.enabled) return;
    if (!referralCode) return;
    if (shareAnalytics.campaigns.length !== 0) {
      setDefaultCampaignsEnsured(true);
      return;
    }

    const ensureDefaults = async () => {
      setDefaultCampaignsEnsuring(true);
      try {
        const missing = computeMissingDefaultReferralCampaigns([]);
        for (const template of missing) {
          const response = await fetch("/api/referrals/campaigns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: template.name,
              channel: template.channel,
              utm_source: template.utm_source,
              utm_medium: null,
              utm_campaign: null,
              utm_content: null,
              landing_path: template.landing_path,
            }),
          });

          // Idempotency: ignore duplicates (unique owner_id + name).
          if (response.status === 409) continue;
          if (!response.ok) break;
        }
      } catch {
        // Best effort; user can still create campaigns manually.
      } finally {
        setDefaultCampaignsEnsured(true);
        setDefaultCampaignsEnsuring(false);
        await loadShareAnalytics();
      }
    };

    void ensureDefaults();
  }, [
    defaultCampaignsEnsured,
    defaultCampaignsEnsuring,
    referralCode,
    shareAnalytics.enabled,
    shareAnalytics.campaigns.length,
    shareAnalyticsLoading,
  ]);

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
    const message =
      "Join me on PropatyHub. Earn credits as you grow your listings. Start with my referral link: " +
      referralLink;
    return {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
      email: `mailto:?subject=${encodeURIComponent("Join me on PropatyHub")}&body=${encodeURIComponent(message)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
    };
  }, [referralLink]);

  const trackingShareTargets = useMemo(() => {
    if (!latestShareLink) return { whatsapp: "", email: "", linkedin: "" };
    const message = `Join me on PropatyHub with this tracked invite link: ${latestShareLink}`;
    return {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
      email: `mailto:?subject=${encodeURIComponent("Join me on PropatyHub")}&body=${encodeURIComponent(message)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(latestShareLink)}`,
    };
  }, [latestShareLink]);

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

  const copyTrackingLink = async (value: string) => {
    if (!value || !navigator?.clipboard) {
      setToast({ message: "Unable to copy link", variant: "error" });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setToast({ message: "Link copied", variant: "success" });
    } catch {
      setToast({ message: "Unable to copy link", variant: "error" });
    }
  };

  const createTrackingCampaign = async () => {
    setCampaignCreateError(null);
    if (!campaignForm.name.trim()) {
      setCampaignCreateError("Campaign name is required.");
      return;
    }

    setCampaignCreatePending(true);
    try {
      const response = await fetch("/api/referrals/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignForm.name.trim(),
          channel: campaignForm.channel,
          utm_source: campaignForm.utm_source.trim() || null,
          utm_medium: campaignForm.utm_medium.trim() || null,
          utm_campaign: campaignForm.utm_campaign.trim() || null,
          utm_content: campaignForm.utm_content.trim() || null,
          landing_path: campaignForm.landing_path.trim() || "/",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setCampaignCreateError(String(payload?.error || "Unable to create tracking link."));
        return;
      }

      const createdLink = String(payload.campaign?.shareLink || "");
      setLatestShareLink(createdLink || null);
      setCampaignForm((current) => ({
        ...current,
        name: "",
        utm_content: "",
      }));
      await loadShareAnalytics();
      setToast({ message: "Tracking link created", variant: "success" });
    } catch {
      setCampaignCreateError("Unable to create tracking link.");
    } finally {
      setCampaignCreatePending(false);
    }
  };

  const requestCashout = async () => {
    const creditsRequested = Math.max(0, Math.trunc(Number(cashoutCreditsInput || 0)));
    setCashoutError(null);

    if (!creditsRequested) {
      setCashoutError("Enter credits to cash out.");
      return;
    }

    setCashoutPending(true);
    try {
      const response = await fetch("/api/referrals/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits_requested: creditsRequested }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok) {
        const reason = String(payload?.reason || payload?.error || "Unable to request cashout.");
        setCashoutError(reason.replace(/_/g, " ").toLowerCase());
        return;
      }

      const nextRequest = payload?.request
        ? ({
            id: String(payload.request.id),
            credits_requested: Math.max(
              0,
              Math.trunc(Number(payload.request.credits_requested || 0))
            ),
            cash_amount: Math.max(0, Number(payload.request.cash_amount || 0)),
            currency: String(payload.request.currency || cashoutPolicy.currency || "NGN"),
            status: String(payload.request.status || "pending") as CashoutRequest["status"],
            requested_at: new Date().toISOString(),
            payout_reference: null,
          } as CashoutRequest)
        : null;

      if (nextRequest) {
        setCashoutHistory((current) => [nextRequest, ...current].slice(0, 10));
      }

      if (payload?.wallet) {
        setWalletState({
          total_balance: Math.max(0, Math.trunc(Number(payload.wallet.total_balance || 0))),
          held_credits: Math.max(0, Math.trunc(Number(payload.wallet.held_credits || 0))),
          available_credits: Math.max(0, Math.trunc(Number(payload.wallet.available_credits || 0))),
        });
      }

      setCashoutCreditsInput("");
      setToast({ message: "Cashout request submitted", variant: "success" });
    } catch {
      setCashoutError("Unable to request cashout right now.");
    } finally {
      setCashoutPending(false);
    }
  };

  const claimMilestone = async (milestoneId: string) => {
    setClaimingMilestoneId(milestoneId);
    try {
      const response = await fetch("/api/referrals/milestones/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok) {
        const reason = String(payload?.reason || payload?.error || "Unable to claim milestone bonus");
        setToast({ message: reason.replace(/_/g, " ").toLowerCase(), variant: "error" });
        return;
      }

      if (payload?.dashboard?.wallet) {
        setWalletState({
          total_balance: Math.max(0, Math.trunc(Number(payload.dashboard.wallet.total_balance || 0))),
          held_credits: Math.max(0, Math.trunc(Number(payload.dashboard.wallet.held_credits || 0))),
          available_credits: Math.max(
            0,
            Math.trunc(Number(payload.dashboard.wallet.available_credits || 0))
          ),
        });
      }
      if (payload?.dashboard?.tier) {
        setTierState(payload.dashboard.tier as ReferralTierStatus);
      }
      if (Array.isArray(payload?.dashboard?.milestones)) {
        setMilestoneState(payload.dashboard.milestones as ReferralMilestoneStatus[]);
      }

      setToast({
        message: payload?.claim?.alreadyClaimed
          ? "Milestone already claimed"
          : "Milestone bonus claimed",
        variant: "success",
      });
    } catch {
      setToast({ message: "Unable to claim milestone bonus", variant: "error" });
    } finally {
      setClaimingMilestoneId(null);
    }
  };

  const setLeaderboardVisibility = async (visible: boolean) => {
    setLeaderboardSaving(true);
    try {
      const response = await fetch("/api/referrals/leaderboard-preference", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setToast({ message: "Unable to update leaderboard visibility", variant: "error" });
        return;
      }
      setLeaderboardOptedOut(Boolean(payload.optedOut));
      setToast({
        message: visible ? "Leaderboard visibility enabled" : "Leaderboard visibility disabled",
        variant: "success",
      });
    } catch {
      setToast({ message: "Unable to update leaderboard visibility", variant: "error" });
    } finally {
      setLeaderboardSaving(false);
    }
  };

  const tierRemaining =
    tierState.nextThreshold !== null
      ? Math.max(0, tierState.nextThreshold - verifiedReferrals)
      : 0;
  const sortedMilestones = useMemo(
    () => [...milestoneState].sort((a, b) => a.threshold - b.threshold),
    [milestoneState]
  );
  const nextMilestone = useMemo(
    () => sortedMilestones.find((milestone) => milestone.status !== "claimed") ?? null,
    [sortedMilestones]
  );
  const nextMilestoneRemaining = nextMilestone
    ? Math.max(0, nextMilestone.threshold - verifiedReferrals)
    : 0;
  const nextMilestoneProgress = nextMilestone
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (Math.min(verifiedReferrals, nextMilestone.threshold) /
              Math.max(1, nextMilestone.threshold)) *
              100
          )
        )
      )
    : 100;
  const selectedLeaderboard =
    leaderboard.windows.find((window) => window.window === selectedLeaderboardWindow) ??
    leaderboard.windows[0] ??
    null;

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Referrals</h1>
          <p className="text-sm text-slate-600">
            Invite agents/landlords to PropatyHub. Earn PropatyHub Credits when they make verified
            payments.
          </p>

          <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <p className="font-semibold">Share link → referrals join → become Active → tier improves → rewards earned.</p>
          </div>

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
              <span className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500">
                QR code coming soon
              </span>
            </div>
          </div>

          <div className="mt-3">
            <Link
              href="/help/agents#referrals"
              className="text-sm font-semibold text-slate-800 underline underline-offset-4"
            >
              Learn how referrals work
            </Link>
          </div>
        </section>

        <section
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          data-testid="referrals-share-analytics-section"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Share analytics</h2>
              <p className="text-sm text-slate-600">
                Track campaign clicks, captures, active referrals, and credited earnings.
              </p>
            </div>
            <Link
              href="/dashboard/referrals/invites"
              className="text-sm font-semibold text-slate-800 underline underline-offset-4"
            >
              Open invite reminders
            </Link>
          </div>

          {shareAnalyticsLoading ? (
            <p className="mt-3 text-sm text-slate-600">Loading share analytics...</p>
          ) : shareAnalyticsError ? (
            <p className="mt-3 text-sm text-rose-600">{shareAnalyticsError}</p>
          ) : !shareAnalytics.enabled ? (
            <p className="mt-3 text-sm text-slate-600">
              Share tracking is currently disabled by admin.
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Clicks</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {formatNumber(shareAnalytics.totals.clicks)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Captures</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {formatNumber(shareAnalytics.totals.captures)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Active referrals</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {formatNumber(shareAnalytics.totals.activeReferrals)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Credits earned</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {shareAnalytics.totals.earningsCredits.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div
                  className="rounded-xl border border-slate-200 bg-white p-4"
                  data-testid="referrals-funnel-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Funnel</p>
                      <p className="text-xs text-slate-600">Last 30 days</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Clicks</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {formatNumber(shareAnalytics.funnel30d.clicks)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Captures</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {formatNumber(shareAnalytics.funnel30d.captures)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Active referrals</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {formatNumber(shareAnalytics.funnel30d.activeReferrals)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Credits earned</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {shareAnalytics.funnel30d.earningsCredits.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-xl border border-slate-200 bg-white p-4"
                  data-testid="referrals-top-channel-card"
                >
                  <p className="text-sm font-semibold text-slate-900">Top channel</p>
                  <p className="text-xs text-slate-600">
                    Best campaign by active referrals (all time)
                  </p>
                  {shareAnalytics.topChannel ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {shareAnalytics.topChannel.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {shareAnalytics.topChannel.channel}
                        {shareAnalytics.topChannel.utm_source
                          ? ` · utm_source=${shareAnalytics.topChannel.utm_source}`
                          : ""}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">
                          {formatNumber(shareAnalytics.topChannel.activeReferrals)}
                        </span>{" "}
                        active referrals
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">
                      No top channel yet. Create a tracking link to start measuring results.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Create tracking link</p>
                <p className="text-xs text-slate-600">
                  Attribution window: {formatNumber(shareAnalytics.attributionWindowDays)} days.
                  We attribute based on the last saved campaign link before signup.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="text-xs uppercase tracking-wide text-slate-500">Campaign name</span>
                    <Input
                      value={campaignForm.name}
                      onChange={(event) =>
                        setCampaignForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="e.g. WhatsApp Abuja February"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="text-xs uppercase tracking-wide text-slate-500">Channel</span>
                    <Select
                      value={campaignForm.channel}
                      onChange={(event) =>
                        setCampaignForm((current) => ({ ...current, channel: event.target.value }))
                      }
                    >
                      {SHARE_CHANNEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="text-xs uppercase tracking-wide text-slate-500">Landing path</span>
                    <Input
                      value={campaignForm.landing_path}
                      onChange={(event) =>
                        setCampaignForm((current) => ({
                          ...current,
                          landing_path: event.target.value,
                        }))
                      }
                      placeholder="/auth/register"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="text-xs uppercase tracking-wide text-slate-500">UTM source</span>
                    <Input
                      value={campaignForm.utm_source}
                      onChange={(event) =>
                        setCampaignForm((current) => ({ ...current, utm_source: event.target.value }))
                      }
                      placeholder="whatsapp"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="text-xs uppercase tracking-wide text-slate-500">UTM medium</span>
                    <Input
                      value={campaignForm.utm_medium}
                      onChange={(event) =>
                        setCampaignForm((current) => ({ ...current, utm_medium: event.target.value }))
                      }
                      placeholder="social"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="text-xs uppercase tracking-wide text-slate-500">UTM campaign</span>
                    <Input
                      value={campaignForm.utm_campaign}
                      onChange={(event) =>
                        setCampaignForm((current) => ({
                          ...current,
                          utm_campaign: event.target.value,
                        }))
                      }
                      placeholder="feb-growth"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void createTrackingCampaign()}
                    disabled={campaignCreatePending}
                    data-testid="referrals-create-tracking-link"
                  >
                    {campaignCreatePending ? "Creating..." : "Create tracking link"}
                  </Button>
                  <Link
                    href="/dashboard/referrals/campaigns"
                    className="text-sm font-semibold text-slate-800 underline underline-offset-4"
                  >
                    View campaigns
                  </Link>
                </div>
                {campaignCreateError ? (
                  <p className="mt-2 text-sm text-rose-600">{campaignCreateError}</p>
                ) : null}

                {latestShareLink ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Latest link</p>
                    <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input value={latestShareLink} readOnly data-testid="referrals-latest-share-link" />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void copyTrackingLink(latestShareLink)}
                      >
                        Copy link
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {trackingShareTargets.whatsapp ? (
                        <a
                          href={trackingShareTargets.whatsapp}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700"
                        >
                          WhatsApp
                        </a>
                      ) : null}
                      {trackingShareTargets.email ? (
                        <a
                          href={trackingShareTargets.email}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700"
                        >
                          Email
                        </a>
                      ) : null}
                      {trackingShareTargets.linkedin ? (
                        <a
                          href={trackingShareTargets.linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700"
                        >
                          LinkedIn
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Top campaigns</p>
                  <Link
                    href="/dashboard/referrals/campaigns"
                    className="text-xs font-semibold text-slate-800 underline underline-offset-4"
                  >
                    View full campaign analytics
                  </Link>
                </div>
                {shareAnalytics.campaigns.length ? (
                  shareAnalytics.campaigns.slice(0, 5).map((campaign) => (
                    <div
                      key={campaign.id}
                      className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 md:grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr_0.9fr_auto]"
                      data-testid={`referrals-campaign-row-${campaign.id}`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{campaign.name}</p>
                        <p className="text-xs text-slate-500">
                          {campaign.channel.toUpperCase()} · {campaign.is_active ? "Active" : "Disabled"}
                        </p>
                      </div>
                      <p className="text-sm text-slate-700">{formatNumber(campaign.clicks)} clicks</p>
                      <p className="text-sm text-slate-700">{formatNumber(campaign.captures)} captures</p>
                      <p className="text-sm text-slate-700">
                        {formatNumber(campaign.activeReferrals)} active
                      </p>
                      <p className="text-sm text-slate-700">
                        {campaign.earningsCredits.toFixed(2)} credits
                      </p>
                      <Link
                        href={`/dashboard/referrals/campaigns/${encodeURIComponent(campaign.id)}`}
                        className="text-sm font-semibold text-slate-800 underline underline-offset-4"
                      >
                        View
                      </Link>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-600">No campaigns yet. Create your first tracking link.</p>
                )}
              </div>
            </>
          )}
        </section>

        {isEmpty && (
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Invite your first referral</h2>
            <p className="mt-2 text-sm text-slate-600">
              Share your link, then help your invite complete a verified payment. Invites become
              Active referrals only after that first verified paid event.
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Share your referral link</li>
              <li>Your invite signs up</li>
              <li>They complete a verified paid event and become Active</li>
              <li>You earn credits and move toward higher tiers and milestones</li>
            </ol>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" onClick={copyLink} disabled={!referralLink}>
                Copy referral link
              </Button>
              {shareTargets.whatsapp ? (
                <a
                  href={shareTargets.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Share on WhatsApp
                </a>
              ) : null}
            </div>
          </section>
        )}

        {!isEmpty && verifiedReferrals === 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <h2 className="text-base font-semibold text-amber-900">No active referrals yet</h2>
            <p className="mt-1 text-sm text-amber-900">
              You already have invites, but none are Active yet. Active referrals are invites that
              have completed at least one verified paid event.
            </p>
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="referrals-metric-total">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total referrals</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(totalReferrals)}</p>
            <p className="text-xs text-slate-600">
              Direct: {formatNumber(directReferrals)} • Indirect: {formatNumber(indirectReferrals)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="referrals-metric-active">
            <p className="text-xs uppercase tracking-wide text-slate-500">Active referrals</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(verifiedReferrals)}</p>
            <p className="text-xs text-slate-600">Based on verified paid events</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="referrals-metric-rewards">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total credits earned</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{creditsEarnedTotal.toFixed(2)}</p>
            <p className="text-xs text-slate-600">
              Issued: {formatNumber(creditsIssuedTotal)} • Used: {formatNumber(creditsUsedTotal)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="referrals-metric-available">
            <p className="text-xs uppercase tracking-wide text-slate-500">Available credits</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(walletState.available_credits)}</p>
            <p className="text-xs text-slate-600">Wallet balance available for use</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="referrals-metric-tier">
            <p className="text-xs uppercase tracking-wide text-slate-500">Tier badge</p>
            <ReferralTierBadge
              tier={tierState.currentTier}
              className="mt-2"
              data-testid="referrals-tier-badge"
            />
            <p className="mt-2 text-xs text-slate-600">Active referrals: {formatNumber(verifiedReferrals)}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Your tier</h2>
              <p className="text-sm text-slate-600">Based on Active referrals only.</p>
            </div>
            <ReferralTierBadge tier={tierState.currentTier} className="text-sm" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current progress</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {formatNumber(verifiedReferrals)} Active referrals
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {tierState.nextTier && tierState.nextThreshold !== null
                  ? `${formatNumber(verifiedReferrals)}/${formatNumber(
                      tierState.nextThreshold
                    )} toward ${tierState.nextTier}`
                  : "Top tier reached"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Next tier goal</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {tierState.nextTier ?? "Completed"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {tierState.nextTier && tierState.nextThreshold !== null
                  ? `${tierRemaining} more Active referrals needed`
                  : "You are currently at the highest tier."}
              </p>
            </div>
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-sky-500 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, tierState.progressToNext))}%` }}
            />
          </div>
        </section>

        {milestonesEnabled && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="referrals-milestones-section">
            <h2 className="text-lg font-semibold text-slate-900">Milestones</h2>
            <p className="text-sm text-slate-600">
              One-time bonus credits unlock at Active referral thresholds.
            </p>

            {sortedMilestones.length ? (
              <div className="mt-4 space-y-3">
                {nextMilestone ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-sky-700">Next milestone</p>
                    <p className="mt-1 text-base font-semibold text-sky-900">
                      {nextMilestone.name} · {formatNumber(nextMilestone.threshold)} Active
                    </p>
                    <p className="mt-1 text-sm text-sky-900">
                      Reward: +{formatNumber(nextMilestone.bonusCredits)} credits.
                      {nextMilestoneRemaining > 0
                        ? ` ${formatNumber(nextMilestoneRemaining)} more Active referrals to unlock.`
                        : " Ready to claim."}
                    </p>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-sky-100">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all"
                        style={{ width: `${nextMilestoneProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900">
                      All milestones completed
                    </p>
                    <p className="mt-1 text-sm text-emerald-800">
                      You have claimed every configured milestone bonus.
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-semibold text-slate-900">All milestones</p>
                  <p className="text-xs text-slate-600">
                    Claiming adds bonus credits to your wallet.
                  </p>
                </div>

                {sortedMilestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
                    data-testid={`referrals-milestone-${milestone.id}`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {milestone.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        Unlock at {formatNumber(milestone.threshold)} Active referrals · Reward +
                        {formatNumber(milestone.bonusCredits)} credits
                      </p>
                      <p className="text-xs text-slate-500">
                        Progress: {formatNumber(Math.min(verifiedReferrals, milestone.threshold))}/
                        {formatNumber(milestone.threshold)} Active
                        {milestone.claimedAt ? ` · Claimed ${formatDate(milestone.claimedAt)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-xs font-semibold",
                          milestoneChipClass(milestone)
                        )}
                      >
                        {formatMilestoneStatus(milestone)}
                      </span>
                      {milestone.claimable ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void claimMilestone(milestone.id)}
                          disabled={claimingMilestoneId === milestone.id}
                        >
                          {claimingMilestoneId === milestone.id ? "Claiming..." : "Claim bonus"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No milestone bonuses configured.</p>
            )}
          </section>
        )}

        {leaderboard.enabled && selectedLeaderboard && (
          <section
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            data-testid="referrals-leaderboard-section"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Top referrers</h2>
                <p className="text-sm text-slate-600">
                  Status ranking based on Active referrals only.
                </p>
              </div>
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
                {leaderboard.availableWindows.map((window) => (
                  <button
                    key={window}
                    type="button"
                    className={cn(
                      "rounded-md px-2 py-1 font-semibold",
                      selectedLeaderboardWindow === window
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    )}
                    onClick={() => setSelectedLeaderboardWindow(window)}
                  >
                    {window === "month" ? "This month" : "All time"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span>How to climb: Invite → referral joins → completes verified paid event.</span>
              <Link
                href="/dashboard/referrals/leaderboard"
                className="font-semibold text-slate-800 underline underline-offset-4"
              >
                View full leaderboard
              </Link>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Your rank</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {selectedLeaderboard.myRank
                  ? `You're ranked #${formatNumber(selectedLeaderboard.myRank)} out of ${formatNumber(
                      selectedLeaderboard.totalAgents
                    )} agents ${selectedLeaderboard.window === "month" ? "this month" : "all time"}.`
                  : `No rank yet for ${
                      selectedLeaderboard.window === "month" ? "this month" : "all time"
                    }.`}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Active referrals counted for you: {formatNumber(selectedLeaderboard.myActiveReferrals)}
              </p>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!leaderboardOptedOut}
                  onChange={(event) => void setLeaderboardVisibility(event.target.checked)}
                  disabled={leaderboardSaving}
                />
                Show me on leaderboard
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Turn this off to hide your profile from Top 10 lists. You can still view your own rank.
              </p>
            </div>

            {leaderboard.publicVisible ? (
              <div className="mt-4 space-y-2">
                {selectedLeaderboard.entries.length ? (
                  selectedLeaderboard.entries.map((entry) => (
                    <div
                      key={`${selectedLeaderboard.window}:${entry.userId}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                          #{formatNumber(entry.rank)}
                        </span>
                        <p className="text-sm font-semibold text-slate-900">{entry.displayName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ReferralTierBadge tier={entry.tier} />
                        <span className="text-xs text-slate-600">
                          {formatNumber(entry.activeReferrals)} Active
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-600">No leaderboard entries available yet.</p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                Leaderboard visibility is currently turned off by admin.
              </p>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Referral tree</h2>
              <p className="text-sm text-slate-600">Showing levels 1 to {depth} based on current settings.</p>
            </div>
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
              {([
                { label: "All", value: "all" },
                { label: "Active", value: "active" },
                { label: "Pending", value: "pending" },
              ] as const).map((filterOption) => (
                <button
                  key={filterOption.value}
                  type="button"
                  className={cn(
                    "rounded-md px-2 py-1 font-semibold",
                    treeFilter === filterOption.value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600"
                  )}
                  onClick={() => setTreeFilter(filterOption.value)}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {levels.map((entry) => {
              const expanded = expandedLevels[entry.level] ?? entry.level === 1;
              const visible = visibleByLevel[entry.level] ?? LEVEL_PAGE_SIZE;
              const filteredNodes =
                treeFilter === "all"
                  ? entry.nodes
                  : entry.nodes.filter((node) => (node.status || "pending") === treeFilter);
              const visibleNodes = filteredNodes.slice(0, visible);

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
                        Level {entry.level} ({filteredNodes.length})
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
                                <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", status.chip)}>
                                  {status.label}
                                </span>
                              </div>
                            );
                          })}
                          {filteredNodes.length > visibleNodes.length && (
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
                        <p className="text-sm text-slate-500">No referrals yet for this filter.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Wallet & cashout</h2>
              <p className="text-sm text-slate-600">
                Credits can be used for: Publishing listings, Featuring listings.
              </p>
              <p className="text-xs text-slate-500">
                Cashout is only available in certain countries and may be disabled.
              </p>
            </div>
            {cashoutEnabled ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Cashout available
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total balance</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(walletState.total_balance)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Held credits</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(walletState.held_credits)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Available credits</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(walletState.available_credits)}</p>
            </div>
          </div>

          {cashoutEnabled ? (
            <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">
                Country: <span className="font-semibold">{jurisdictionCountryCode}</span> · Rate: <span className="font-semibold">1 credit = {formatCurrency(cashoutPolicy.credit_to_cash_rate, cashoutPolicy.currency)}</span> · Minimum: <span className="font-semibold">{formatNumber(cashoutPolicy.min_cashout_credits)} credits</span>
              </p>
              {cashoutPolicy.monthly_cashout_cap_amount > 0 ? (
                <p className="text-xs text-slate-600">
                  Monthly cashout cap: {formatCurrency(cashoutPolicy.monthly_cashout_cap_amount, cashoutPolicy.currency)}
                </p>
              ) : (
                <p className="text-xs text-slate-600">No monthly cashout cap configured.</p>
              )}

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={cashoutCreditsInput}
                  onChange={(event) => setCashoutCreditsInput(event.target.value)}
                  placeholder={`Enter credits (min ${cashoutPolicy.min_cashout_credits})`}
                  aria-label="Cashout credits"
                />
                <Button type="button" onClick={requestCashout} disabled={cashoutPending}>
                  {cashoutPending ? "Requesting..." : "Request cashout"}
                </Button>
              </div>
              {cashoutError ? <p className="text-sm text-rose-700">{cashoutError}</p> : null}

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Recent cashout requests</p>
                {cashoutHistory.length ? (
                  cashoutHistory.slice(0, 10).map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <p className="text-sm text-slate-700">
                        {formatNumber(request.credits_requested)} credits · {formatCurrency(request.cash_amount, request.currency)}
                      </p>
                      <p className="text-xs text-slate-600">
                        {formatCashoutStatus(request.status)} · {formatDate(request.requested_at)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No cashout requests yet.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600" data-testid="referrals-cashout-disabled">
              Cashout unavailable in your country. ({jurisdictionCountryCode})
            </p>
          )}
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
                        <span className="ml-1 font-semibold text-slate-900">{item.rewardAmount.toFixed(2)}</span>
                        <span className="ml-1">{formatRewardType(item.rewardType)}</span>
                      </p>
                    ) : (
                      <p>
                        <span className="font-semibold text-slate-900">{item.label}</span>
                        <span className="ml-1">joined your network at level {item.level}</span>
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">{formatDate(item.issuedAt)}</p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">No referral activity yet.</p>
            )}
          </div>
        </section>
      </div>

      {toast && (
        <Alert
          variant={toast.variant === "error" ? "error" : "success"}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
          description={toast.message}
        />
      )}
    </>
  );
}
