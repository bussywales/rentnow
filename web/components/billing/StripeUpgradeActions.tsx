"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import type { PlanTier } from "@/lib/plans";

type Cadence = "monthly" | "yearly";

type Props = {
  defaultTier?: PlanTier;
  stripeEnabled: boolean;
  stripeStatus?: string | null;
  stripePeriodEnd?: string | null;
  showManage?: boolean;
  showUpgrade?: boolean;
};

export function StripeUpgradeActions({
  defaultTier = "starter",
  stripeEnabled,
  stripeStatus,
  stripePeriodEnd,
  showManage = false,
  showUpgrade = true,
}: Props) {
  const [tier, setTier] = useState<PlanTier>(defaultTier);
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = stripeStatus ? stripeStatus.replace(/_/g, " ") : null;
  const periodLabel = stripePeriodEnd ? new Date(stripePeriodEnd).toLocaleDateString() : null;

  const startCheckout = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const openPortal = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  if (!stripeEnabled) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={tier} onChange={(event) => setTier(event.target.value as PlanTier)}>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
        </Select>
        <Select value={cadence} onChange={(event) => setCadence(event.target.value as Cadence)}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </Select>
        {showUpgrade && (
          <Button variant="secondary" size="sm" onClick={startCheckout} disabled={loading}>
            {loading ? "Redirecting..." : "Upgrade with Stripe"}
          </Button>
        )}
        {showManage && (
          <Button variant="secondary" size="sm" onClick={openPortal} disabled={loading}>
            Manage subscription
          </Button>
        )}
      </div>
      {statusLabel && (
        <p className="text-xs text-slate-600">
          Stripe status: {statusLabel}
          {periodLabel ? ` • Renews ${periodLabel}` : ""}
        </p>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
