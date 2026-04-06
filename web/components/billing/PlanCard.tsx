"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getPlanForTier, getTenantPlanForTier, type PlanTier } from "@/lib/plans";
import type { SubscriptionPlanCardConfig } from "@/lib/billing/subscription-plan-cards";
import type { SubscriptionPlanPricingView } from "@/lib/billing/subscription-pricing.types";
import { describeSubscriptionMarketCharge } from "@/lib/billing/subscription-pricing";

type Props = {
  plan: SubscriptionPlanCardConfig;
  priceLabel: string;
  priceSubLabel?: string | null;
  pricing: SubscriptionPlanPricingView | null;
  currentTier: PlanTier;
  currentRole: string | null;
  billingSource: string;
  stripeManageAvailable: boolean;
  paystackMode?: string;
  flutterwaveMode?: string;
  pendingUpgrade: boolean;
  loadingKey: string | null;
  cadenceLabel: string;
  usageCount: number;
  marketDrifted: boolean;
  onUpgrade: (tier: PlanTier) => void;
  onPaystack?: (tier: PlanTier) => void;
  onFlutterwave?: (tier: PlanTier) => void;
  onManage: () => void;
  requestUpgradeAction: (formData: FormData) => void;
};

export function PlanCard({
  plan,
  priceLabel,
  priceSubLabel,
  pricing,
  currentTier,
  currentRole,
  billingSource,
  stripeManageAvailable,
  paystackMode,
  flutterwaveMode,
  pendingUpgrade,
  loadingKey,
  cadenceLabel,
  usageCount,
  marketDrifted,
  onUpgrade,
  onPaystack,
  onFlutterwave,
  onManage,
  requestUpgradeAction,
}: Props) {
  const usageType = plan.usageType ?? "listings";
  const listingGate = usageType === "saved_searches" ? null : getPlanForTier(plan.tier);
  const tenantGate = usageType === "saved_searches" ? getTenantPlanForTier(plan.tier) : null;
  const roleMatches = plan.role ? plan.role === currentRole : true;
  const isCurrent =
    (plan.tier === currentTier && roleMatches) ||
    (plan.tier === "free" && currentTier === "starter");
  const canUpgrade = plan.tier !== "free" && roleMatches && !isCurrent && pricing?.status === "ready" && !marketDrifted;
  const showCurrent = isCurrent && !pendingUpgrade;
  const showRequest = plan.tier !== "free" && roleMatches;
  const usageMax =
    usageType === "saved_searches"
      ? tenantGate?.maxSavedSearches ?? 0
      : listingGate?.maxListings ?? 0;
  const usageLabel = usageType === "saved_searches" ? "Saved searches used" : "Listings used";
  const usageCapLabel =
    usageType === "saved_searches" ? "Saved search limit" : "Listing limit";
  const usageDesc =
    usageType === "saved_searches"
      ? tenantGate?.maxSavedSearches === null
        ? "Unlimited saved searches with instant alerts"
        : `Save up to ${tenantGate?.maxSavedSearches ?? 0} searches`
      : `Publish up to ${listingGate?.maxListings ?? 0} active listings`;
  const usagePercent =
    usageType === "saved_searches" && tenantGate?.maxSavedSearches === null
      ? 100
      : usageMax > 0
      ? Math.min(100, Math.round((usageCount / usageMax) * 100))
      : 0;
  const muted = !roleMatches && !!plan.role;
  const checkoutLabel =
    pricing?.provider === "paystack"
      ? paystackMode === "live"
        ? "Pay with Paystack"
        : "Pay with Paystack (Test)"
      : pricing?.provider === "flutterwave"
      ? flutterwaveMode === "live"
        ? "Pay with Flutterwave"
        : "Pay with Flutterwave (Test)"
      : "Upgrade";

  const handleUpgrade = () => {
    if (pricing?.provider === "paystack") {
      onPaystack?.(plan.tier);
      return;
    }
    if (pricing?.provider === "flutterwave") {
      onFlutterwave?.(plan.tier);
      return;
    }
    onUpgrade(plan.tier);
  };

  const actionKey =
    pricing?.provider === "paystack"
      ? `paystack:${plan.tier}`
      : pricing?.provider === "flutterwave"
      ? `flutterwave:${plan.tier}`
      : plan.tier;
  const loadingLabel =
    pricing?.provider === "stripe" || !pricing?.provider ? "Redirecting..." : "Opening checkout...";
  const marketChargeDisclosure = describeSubscriptionMarketCharge(pricing);

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
        <p className="text-3xl font-semibold">{plan.tier === "free" ? "Free" : priceLabel}</p>
        <div className={`text-sm ${plan.highlight ? "text-white/70" : "text-slate-500"}`}>
          <p>{plan.tier === "free" ? "Always free" : cadenceLabel}</p>
          {priceSubLabel && <p className="font-semibold">{priceSubLabel}</p>}
        </div>
      </div>
      {!roleMatches && plan.role && (
        <p className={`mt-3 text-xs ${plan.highlight ? "text-white/70" : "text-slate-500"}`}>
          Available when using a{" "}
          {plan.role === "agent" ? "Agent" : plan.role === "tenant" ? "Tenant" : "Landlord"} account.
        </p>
      )}
      <div className="mt-4 text-sm">
        <p className="font-semibold">{usageCapLabel}</p>
        <p className={plan.highlight ? "text-white/80" : "text-slate-600"}>
          {usageDesc}
        </p>
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs">
            <span className={plan.highlight ? "text-white/70" : "text-slate-500"}>
              {usageLabel}
            </span>
            <span className={plan.highlight ? "text-white/70" : "text-slate-500"}>
              {tenantGate?.maxSavedSearches === null && usageType === "saved_searches"
                ? `${usageCount} / ∞`
                : `${Math.min(usageCount, usageMax)} / ${usageMax}`}
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
            onClick={handleUpgrade}
            disabled={loadingKey === actionKey}
          >
            {loadingKey === actionKey ? loadingLabel : checkoutLabel}
          </Button>
        ) : plan.tier === "free" ? (
          <Button variant="secondary" disabled>
            Free forever
          </Button>
        ) : marketDrifted ? (
          <Button variant="secondary" disabled>
            Refresh pricing
          </Button>
        ) : pricing?.status === "unavailable" ? (
          <Button variant="secondary" disabled>
            Not available
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

      {plan.tier !== "free" && marketChargeDisclosure ? (
        <p
          className={`mt-3 text-xs ${
            plan.highlight
              ? "text-white/80"
              : marketChargeDisclosure.tone === "warning"
              ? "text-amber-700"
              : "text-cyan-700"
          }`}
        >
          {marketChargeDisclosure.body}
        </p>
      ) : null}

      {plan.tier !== "free" && pricing?.status === "unavailable" && pricing.unavailableReason ? (
        <p className={`mt-3 text-xs ${plan.highlight ? "text-white/80" : "text-slate-500"}`}>
          {pricing.unavailableReason}
        </p>
      ) : null}

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
