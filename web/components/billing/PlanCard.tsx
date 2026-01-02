"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getPlanForTier, type PlanTier } from "@/lib/plans";

type BillingRole = "landlord" | "agent";

export type PlanCardConfig = {
  key: string;
  title: string;
  tier: PlanTier;
  role?: BillingRole;
  highlight?: boolean;
  features: string[];
};

type Props = {
  plan: PlanCardConfig;
  priceLabel: string;
  priceSubLabel?: string | null;
  currentTier: PlanTier;
  currentRole: string | null;
  billingSource: string;
  stripeManageAvailable: boolean;
  stripeEnabled: boolean;
  pendingUpgrade: boolean;
  loadingKey: string | null;
  cadenceLabel: string;
  usageCount: number;
  onUpgrade: (tier: PlanTier) => void;
  onManage: () => void;
  requestUpgradeAction: (formData: FormData) => void;
};

export function PlanCard({
  plan,
  priceLabel,
  priceSubLabel,
  currentTier,
  currentRole,
  billingSource,
  stripeManageAvailable,
  stripeEnabled,
  pendingUpgrade,
  loadingKey,
  cadenceLabel,
  usageCount,
  onUpgrade,
  onManage,
  requestUpgradeAction,
}: Props) {
  const planGate = getPlanForTier(plan.tier);
  const roleMatches = plan.role ? plan.role === currentRole : true;
  const isCurrent =
    (plan.tier === currentTier && roleMatches) ||
    (plan.tier === "free" && currentTier === "starter");
  const canUpgrade = plan.tier !== "free" && stripeEnabled && roleMatches && !isCurrent;
  const showCurrent = isCurrent && !pendingUpgrade;
  const showRequest = plan.tier !== "free" && roleMatches;
  const usageMax = planGate.maxListings;
  const usagePercent = usageMax > 0 ? Math.min(100, Math.round((usageCount / usageMax) * 100)) : 0;
  const muted = !roleMatches && !!plan.role;

  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-5 shadow-sm ${
        plan.highlight ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
      } ${muted ? "opacity-60 grayscale" : ""}`}
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
        <p className="text-3xl font-semibold">{plan.tier === "free" ? "£0" : priceLabel}</p>
        <div className={`text-sm ${plan.highlight ? "text-white/70" : "text-slate-500"}`}>
          <p>{plan.tier === "free" ? "Always free" : cadenceLabel}</p>
          {priceSubLabel && <p className="font-semibold">{priceSubLabel}</p>}
        </div>
      </div>
      {!roleMatches && plan.role && (
        <p className={`mt-3 text-xs ${plan.highlight ? "text-white/70" : "text-slate-500"}`}>
          Available when using a {plan.role === "agent" ? "Agent" : "Landlord"} account.
        </p>
      )}
      <div className="mt-4 text-sm">
        <p className="font-semibold">Listing limit</p>
        <p className={plan.highlight ? "text-white/80" : "text-slate-600"}>
          Publish up to {planGate.maxListings} active listings
        </p>
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs">
            <span className={plan.highlight ? "text-white/70" : "text-slate-500"}>
              Listings used
            </span>
            <span className={plan.highlight ? "text-white/70" : "text-slate-500"}>
              {Math.min(usageCount, usageMax)} / {usageMax}
            </span>
          </div>
          <div className={`mt-2 h-2 w-full rounded-full ${plan.highlight ? "bg-white/10" : "bg-slate-100"}`}>
            <div
              className={`h-2 rounded-full ${plan.highlight ? "bg-white" : "bg-slate-900"}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
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
            onClick={() => onUpgrade(plan.tier)}
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
            Not available
          </Button>
        )}

        {isCurrent && billingSource === "stripe" && stripeManageAvailable && (
          <button
            type="button"
            onClick={onManage}
            disabled={loadingKey === "portal"}
            className={`text-left text-sm font-semibold ${
              plan.highlight ? "text-white/80 hover:text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {loadingKey === "portal" ? "Opening..." : "Manage subscription"}
          </button>
        )}

        {isCurrent && billingSource === "manual" && (
          <Link
            href="/support?intent=billing"
            className={`text-sm font-semibold ${
              plan.highlight ? "text-white/80 hover:text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Contact support
          </Link>
        )}
      </div>

      {showRequest && (
        <form action={requestUpgradeAction} className="mt-3">
          <input type="hidden" name="plan_tier" value={plan.tier} />
          <button
            type="submit"
            disabled={pendingUpgrade}
            className={`text-left text-sm font-semibold ${
              plan.highlight ? "text-white/80 hover:text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {pendingUpgrade ? "Request sent" : "Request invoice / bank transfer"}
          </button>
        </form>
      )}
    </div>
  );
}
