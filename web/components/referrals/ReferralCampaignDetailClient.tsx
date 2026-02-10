"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { ReferralCampaignDetail } from "@/lib/referrals/share-tracking.server";

type Props = {
  campaignId: string;
  initialDetail: ReferralCampaignDetail;
};

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString();
}

export default function ReferralCampaignDetailClient({ campaignId, initialDetail }: Props) {
  const [detail, setDetail] = useState(initialDetail);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const toggleActive = async () => {
    setPending(true);
    setError(null);
    setToast(null);
    try {
      const response = await fetch(`/api/referrals/campaigns/${encodeURIComponent(campaignId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !detail.campaign.is_active }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setError(String(payload?.error || "Unable to update campaign."));
        return;
      }
      setDetail((current) => ({
        ...current,
        campaign: {
          ...current.campaign,
          is_active: Boolean(payload.campaign?.is_active),
          shareLink: String(payload.campaign?.shareLink || current.campaign.shareLink),
        },
      }));
      setToast(detail.campaign.is_active ? "Campaign disabled" : "Campaign enabled");
    } catch {
      setError("Unable to update campaign.");
    } finally {
      setPending(false);
    }
  };

  const copyLink = async () => {
    if (!navigator?.clipboard) return;
    await navigator.clipboard.writeText(detail.campaign.shareLink);
    setToast("Link copied");
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="referral-campaign-detail-header">
        <h1 className="text-2xl font-semibold text-slate-900">{detail.campaign.name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Channel: {detail.campaign.channel.toUpperCase()} · {detail.campaign.is_active ? "Active" : "Disabled"}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard/referrals/campaigns" className="font-semibold text-slate-900 underline underline-offset-4">
            Back to campaigns
          </Link>
          <Link href="/dashboard/referrals" className="font-semibold text-slate-900 underline underline-offset-4">
            Referrals dashboard
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Clicks (30d)</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatNumber(detail.metrics.clicks30d)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Clicks (all)</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatNumber(detail.metrics.clicksAllTime)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Captures</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatNumber(detail.metrics.captures)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active referrals</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatNumber(detail.metrics.activeReferrals)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Credits earned</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{detail.metrics.earningsCredits.toFixed(2)}</p>
          <p className="text-xs text-slate-500">CR: {detail.metrics.conversionRate.toFixed(2)}%</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Share link</h2>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 break-all">
          {detail.campaign.shareLink}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => void copyLink()}>
            Copy link
          </Button>
          <Button type="button" size="sm" onClick={() => void toggleActive()} disabled={pending}>
            {pending ? "Saving..." : detail.campaign.is_active ? "Disable campaign" : "Enable campaign"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Timeline (last months)</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {detail.timeline.length ? (
            detail.timeline.map((point) => (
              <div key={point.period} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{point.period}</p>
                <p className="text-sm text-slate-700">{formatNumber(point.clicks)} clicks</p>
                <p className="text-sm text-slate-700">{formatNumber(point.captures)} captures</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No timeline points yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Converted users (masked)</h2>
        <div className="mt-3 space-y-2">
          {detail.convertedUsers.length ? (
            detail.convertedUsers.map((item) => (
              <div
                key={`${item.userId}:${item.date}`}
                className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:grid-cols-[1fr_auto_auto]"
              >
                <p className="text-sm font-semibold text-slate-900">{item.displayName}</p>
                <p className="text-sm text-slate-700">{item.status.replace(/_/g, " ")}</p>
                <p className="text-xs text-slate-500">{new Date(item.date).toLocaleDateString()}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No converted users yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Country breakdown</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {detail.byCountry.length ? (
            detail.byCountry.map((item) => (
              <div key={item.countryCode} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {item.countryCode}: {formatNumber(item.clicks)} clicks
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No country breakdown yet.</p>
          )}
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{toast}</div>
      ) : null}
    </div>
  );
}
