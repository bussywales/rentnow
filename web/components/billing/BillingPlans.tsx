"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getPlanForTier, type PlanTier } from "@/lib/plans";

type Cadence = "monthly" | "yearly";
type BillingRole = "landlord" | "agent";

type PlanCard = {
  key: string;
  title: string;
  tier: PlanTier;
  role?: BillingRole;
  highlight?: boolean;
  features: string[];
};

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

const PLAN_CARDS: PlanCard[] = [
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

export function BillingPlans({
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
    return cadence === "monthly" ? "Billed monthly" : "Billed yearly";
  }, [cadence]);

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
        {PLAN_CARDS.map((plan) => {
          const planGate = getPlanForTier(plan.tier);
          const roleMatches = plan.role ? plan.role === currentRole : true;
          const isCurrent =
            (plan.tier === currentTier && roleMatches) ||
            (plan.tier === "free" && currentTier === "starter");
          const canUpgrade = plan.tier !== "free" && stripeEnabled && roleMatches && !isCurrent;
          const showCurrent = isCurrent && !pendingUpgrade;
          const showRequest = plan.tier !== "free" && roleMatches;

          return (
            <div
              key={plan.key}
              className={`flex h-full flex-col rounded-2xl border p-5 shadow-sm ${
                plan.highlight
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{plan.title}</h3>
                {plan.highlight && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    Popular
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="text-3xl font-semibold">
                  {plan.tier === "free" ? "£0" : "Stripe"}
                </p>
                <p
                  className={`text-sm ${
                    plan.highlight ? "text-white/70" : "text-slate-500"
                  }`}
                >
                  {plan.tier === "free" ? "Always free" : priceLabel}
                </p>
              </div>
              <div className="mt-4 text-sm">
                <p className="font-semibold">Listing limit</p>
                <p className={plan.highlight ? "text-white/80" : "text-slate-600"}>
                  {planGate.maxListings} active listings
                </p>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className={plan.highlight ? "text-white/80" : "text-slate-600"}>
                    • {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-2">
                {showCurrent ? (
                  <Button variant={plan.highlight ? "secondary" : "primary"} disabled>
                    Current plan
                  </Button>
                ) : canUpgrade ? (
                  <Button
                    variant={plan.highlight ? "secondary" : "primary"}
                    onClick={() => startCheckout(plan.tier)}
                    disabled={loadingKey === plan.tier}
                  >
                    {loadingKey === plan.tier ? "Redirecting..." : "Upgrade"}
                  </Button>
                ) : plan.tier === "free" ? (
                  <Button variant="secondary" disabled>
                    Free forever
                  </Button>
                ) : (
                  <Button variant="secondary" disabled>
                    Not available for your role
                  </Button>
                )}

                {isCurrent && billingSource === "stripe" && showManage && (
                  <Button
                    variant="secondary"
                    onClick={openPortal}
                    disabled={loadingKey === "portal"}
                  >
                    {loadingKey === "portal" ? "Opening..." : "Manage subscription"}
                  </Button>
                )}

                {isCurrent && billingSource === "manual" && (
                  <Link href="/support?intent=billing">
                    <Button variant="secondary">Contact support</Button>
                  </Link>
                )}
              </div>

              {showRequest && (
                <form action={requestUpgradeAction} className="mt-3">
                  <input type="hidden" name="plan_tier" value={plan.tier} />
                  <Button
                    type="submit"
                    variant="ghost"
                    className={plan.highlight ? "text-white hover:bg-white/10" : ""}
                    disabled={pendingUpgrade}
                  >
                    {pendingUpgrade ? "Request sent" : "Request invoice / bank transfer"}
                  </Button>
                </form>
              )}
            </div>
          );
        })}
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
