"use client";

import { useMemo, useState } from "react";
import type { PlanTier } from "@/lib/plans";
import { PlanCard, type PlanCardConfig } from "@/components/billing/PlanCard";

type Cadence = "monthly" | "yearly";

type Props = {
  currentTier: PlanTier;
  currentRole: string | null;
  billingSource: string;
  stripeStatus?: string | null;
  stripePeriodEnd?: string | null;
  stripeEnabled: boolean;
  showManage: boolean;
  pendingUpgrade: boolean;
  activeCount: number;
  maxListings: number;
  requestUpgradeAction: (formData: FormData) => void;
};

const PLAN_CARDS: PlanCardConfig[] = [
  {
    key: "free",
    title: "Free",
    tier: "free",
    features: ["1 active listing", "Standard approvals", "Basic support"],
  },
  {
    key: "landlord-pro",
    title: "Landlord Pro",
    tier: "pro",
    role: "landlord",
    highlight: true,
    features: ["Up to 10 active listings", "Featured placement", "Priority approvals"],
  },
  {
    key: "agent-pro",
    title: "Agent Pro",
    tier: "pro",
    role: "agent",
    features: ["Up to 10 active listings", "Manage multiple landlords", "Priority approvals"],
  },
];

export function PlansGrid({
  currentTier,
  currentRole,
  billingSource,
  stripeStatus,
  stripePeriodEnd,
  stripeEnabled,
  showManage,
  pendingUpgrade,
  activeCount,
  maxListings,
  requestUpgradeAction,
}: Props) {
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = stripeStatus ? stripeStatus.replace(/_/g, " ") : null;
  const periodLabel = stripePeriodEnd ? new Date(stripePeriodEnd).toLocaleDateString() : null;
  const limitReached = activeCount >= maxListings;

  const priceLabel = useMemo(() => {
    return cadence === "monthly" ? "Stripe monthly" : "Stripe yearly";
  }, [cadence]);

  const cadenceLabel = cadence === "monthly" ? "Billed monthly" : "Billed yearly";

  const startCheckout = async (tier: PlanTier) => {
    setLoadingKey(tier);
    setError(null);
    try {
      const res = await fetch("/api/billing/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, cadence }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Unable to start checkout.");
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        setError("Stripe did not return a checkout URL.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
    } finally {
      setLoadingKey(null);
    }
  };

  const openPortal = async () => {
    setLoadingKey("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Unable to open billing portal.");
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        setError("Stripe did not return a portal URL.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open billing portal.");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="space-y-6" id="plans">
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Billing interval
          </p>
          <h2 className="text-lg font-semibold text-slate-900">Choose how you want to pay</h2>
        </div>
        <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setCadence("monthly")}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              cadence === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCadence("yearly")}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              cadence === "yearly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      {limitReached && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            You are at your listing limit ({activeCount}/{maxListings}).
          </p>
          <p className="mt-1">Upgrade to publish more listings without delays.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_CARDS.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            priceLabel={priceLabel}
            cadenceLabel={cadenceLabel}
            currentTier={currentTier}
            currentRole={currentRole}
            billingSource={billingSource}
            stripeManageAvailable={showManage}
            stripeEnabled={stripeEnabled}
            pendingUpgrade={pendingUpgrade}
            loadingKey={loadingKey}
            onUpgrade={startCheckout}
            onManage={openPortal}
            requestUpgradeAction={requestUpgradeAction}
          />
        ))}
      </div>

      {statusLabel && (
        <p className="text-xs text-slate-500">
          Stripe status: {statusLabel}
          {periodLabel ? ` • Renews ${periodLabel}` : ""}
        </p>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
