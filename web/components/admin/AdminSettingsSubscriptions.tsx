"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

type PlanRow = {
  id: string;
  role: string | null;
  tier: string | null;
  listing_credits: number | null;
  featured_credits: number | null;
  updated_at?: string | null;
};

type Props = {
  subscriptionsEnabled: boolean;
  subscriptionsUpdatedAt: string | null;
  paygFeaturedAmount: number;
  paygFeaturedUpdatedAt: string | null;
  featuredDurationDays: number;
  featuredDurationUpdatedAt: string | null;
  plans: PlanRow[];
};

type PlanDraft = {
  id: string;
  listing_credits: number;
  featured_credits: number;
};

export default function AdminSettingsSubscriptions({
  subscriptionsEnabled,
  subscriptionsUpdatedAt,
  paygFeaturedAmount,
  paygFeaturedUpdatedAt,
  featuredDurationDays,
  featuredDurationUpdatedAt,
  plans,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(subscriptionsEnabled);
  const [featuredFee, setFeaturedFee] = useState(paygFeaturedAmount);
  const [durationDays, setDurationDays] = useState(featuredDurationDays);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const planDrafts = useMemo(() => {
    const map = new Map<string, PlanDraft>();
    plans.forEach((plan) => {
      map.set(plan.id, {
        id: plan.id,
        listing_credits: plan.listing_credits ?? 0,
        featured_credits: plan.featured_credits ?? 0,
      });
    });
    return map;
  }, [plans]);

  const [drafts, setDrafts] = useState<Map<string, PlanDraft>>(planDrafts);

  const updateSetting = async (payload: Record<string, unknown>, successMessage: string) => {
    const res = await fetch("/api/admin/app-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Could not update setting");
      return false;
    }
    setToast(successMessage);
    return true;
  };

  const toggleSubscriptions = () => {
    setError(null);
    startTransition(async () => {
      setToast(null);
      const next = !enabled;
      const ok = await updateSetting(
        { key: "subscriptions_enabled", value: { enabled: next } },
        next ? "Subscriptions enabled." : "Subscriptions disabled."
      );
      if (ok) setEnabled(next);
    });
  };

  const saveFeaturedFee = () => {
    setError(null);
    startTransition(async () => {
      setToast(null);
      await updateSetting(
        { key: "payg_featured_fee_amount", value: { value: featuredFee } },
        "PAYG featured fee updated."
      );
    });
  };

  const saveDuration = () => {
    setError(null);
    startTransition(async () => {
      setToast(null);
      await updateSetting(
        { key: "featured_duration_days", value: { value: durationDays } },
        "Featured duration updated."
      );
    });
  };

  const updatePlanDraft = (id: string, field: "listing_credits" | "featured_credits", value: number) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      const current = next.get(id);
      if (current) {
        next.set(id, { ...current, [field]: value });
      }
      return next;
    });
  };

  const savePlanCredits = (id: string) => {
    const draft = drafts.get(id);
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      setToast(null);
      const res = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          listing_credits: draft.listing_credits,
          featured_credits: draft.featured_credits,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to update plan credits.");
        return;
      }
      setToast("Plan credits updated.");
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Subscriptions & Featured credits</h2>
          <p className="text-sm text-slate-600">
            Control optional subscriptions, monthly credit bundles, and featured listing pricing.
          </p>
          {subscriptionsUpdatedAt && (
            <p className="text-xs text-slate-500">
              Subscriptions toggle updated {new Date(subscriptionsUpdatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">{enabled ? "Enabled" : "Disabled"}</span>
          <Button size="sm" variant={enabled ? "secondary" : "primary"} disabled={pending} onClick={toggleSubscriptions}>
            {pending ? "Saving..." : enabled ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-sm font-semibold text-slate-900">PAYG featured fee</p>
          <p className="text-xs text-slate-600">Charge when featured credits are unavailable.</p>
          {paygFeaturedUpdatedAt && (
            <p className="text-xs text-slate-500">
              Updated {new Date(paygFeaturedUpdatedAt).toLocaleString()}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={featuredFee}
              onChange={(event) => setFeaturedFee(Number(event.target.value))}
              className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              disabled={pending}
            />
            <Button size="sm" onClick={saveFeaturedFee} disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-sm font-semibold text-slate-900">Featured duration (days)</p>
          <p className="text-xs text-slate-600">How long a featured slot stays active.</p>
          {featuredDurationUpdatedAt && (
            <p className="text-xs text-slate-500">
              Updated {new Date(featuredDurationUpdatedAt).toLocaleString()}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={durationDays}
              onChange={(event) => setDurationDays(Number(event.target.value))}
              className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              disabled={pending}
            />
            <Button size="sm" onClick={saveDuration} disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Monthly credits per plan</p>
            <p className="text-xs text-slate-600">
              Update how many listing and featured credits each plan issues every cycle.
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {plans.map((plan) => {
            const draft = drafts.get(plan.id);
            return (
              <div key={plan.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {plan.role ?? "plan"} · {plan.tier ?? "tier"}
                    </p>
                    <p className="text-xs text-slate-600">
                      Adjust monthly listing + featured credits.
                    </p>
                    {plan.updated_at && (
                      <p className="text-xs text-slate-500">
                        Updated {new Date(plan.updated_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => savePlanCredits(plan.id)} disabled={pending}>
                    {pending ? "Saving..." : "Save"}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="text-xs font-semibold text-slate-600" htmlFor={`plan-${plan.id}-listings`}>
                    Listing credits
                  </label>
                  <input
                    id={`plan-${plan.id}-listings`}
                    type="number"
                    min={0}
                    value={draft?.listing_credits ?? 0}
                    onChange={(event) =>
                      updatePlanDraft(plan.id, "listing_credits", Number(event.target.value))
                    }
                    className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                    disabled={pending}
                  />
                  <label className="text-xs font-semibold text-slate-600" htmlFor={`plan-${plan.id}-featured`}>
                    Featured credits
                  </label>
                  <input
                    id={`plan-${plan.id}-featured`}
                    type="number"
                    min={0}
                    value={draft?.featured_credits ?? 0}
                    onChange={(event) =>
                      updatePlanDraft(plan.id, "featured_credits", Number(event.target.value))
                    }
                    className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                    disabled={pending}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {toast && <p className="mt-2 text-xs text-emerald-600">{toast}</p>}
    </div>
  );
}
