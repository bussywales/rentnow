"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { getTenantPlanForTier, isSavedSearchLimitReached, type PlanTier } from "@/lib/plans";
import { PlanCard } from "@/components/billing/PlanCard";
import {
  SUBSCRIPTION_PLAN_CARDS,
  getSubscriptionPlanCardKeyForRole,
} from "@/lib/billing/subscription-plan-cards";
import type { SubscriptionPlanPricingSet } from "@/lib/billing/subscription-pricing.types";
import {
  describeSubscriptionMarketCharge,
  resolveYearlySavingsLabel,
} from "@/lib/billing/subscription-pricing";
import { trackProductEvent } from "@/lib/analytics/product-events.client";

type Cadence = "monthly" | "yearly";

type Props = {
  currentTier: PlanTier;
  currentRole: string | null;
  billingSource: string;
  stripeStatus?: string | null;
  stripePeriodEnd?: string | null;
  paystackMode: string;
  flutterwaveMode: string;
  flutterwaveCheckoutVisible?: boolean;
  showManage: boolean;
  pendingUpgrade: boolean;
  activeCount: number;
  maxListings: number;
  savedSearchCount: number;
  marketCountry: string;
  marketCurrency: string;
  marketLabel: string;
  lifecycleLabel: string;
  lifecycleDetail?: string | null;
  pricingByPlanKey: Record<string, SubscriptionPlanPricingSet>;
  requestUpgradeAction: (formData: FormData) => void;
};

export function PlansGrid({
  currentTier,
  currentRole,
  billingSource,
  stripeStatus,
  stripePeriodEnd,
  paystackMode,
  flutterwaveMode,
  flutterwaveCheckoutVisible = false,
  showManage,
  pendingUpgrade,
  activeCount,
  maxListings,
  savedSearchCount,
  marketCountry,
  marketCurrency,
  marketLabel,
  lifecycleLabel,
  lifecycleDetail,
  pricingByPlanKey,
  requestUpgradeAction,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { market } = useMarketPreference();
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const verificationRan = useRef(false);

  const statusLabel = stripeStatus ? stripeStatus.replace(/_/g, " ") : null;
  const periodLabel = stripePeriodEnd ? new Date(stripePeriodEnd).toLocaleDateString() : null;
  const tenantPlan = currentRole === "tenant" ? getTenantPlanForTier(currentTier) : null;
  const limitReached =
    currentRole === "tenant"
      ? isSavedSearchLimitReached(savedSearchCount, tenantPlan)
      : activeCount >= maxListings;
  const marketDrifted = market.country !== marketCountry || market.currency !== marketCurrency;
  const activePlanKey = getSubscriptionPlanCardKeyForRole(currentRole);
  const activePricingSet = activePlanKey ? pricingByPlanKey[activePlanKey] ?? null : null;
  const activeQuote = activePricingSet?.[cadence] ?? null;
  const marketChargeDisclosure = describeSubscriptionMarketCharge(activeQuote);

  const cadenceLabel = cadence === "monthly" ? "Billed monthly" : "Billed yearly";

  const startCheckout = async (tier: PlanTier) => {
    const selectedPlan = SUBSCRIPTION_PLAN_CARDS.find(
      (plan) => plan.tier === tier && (plan.role ? plan.role === currentRole : true)
    );
    const selectedPricing =
      selectedPlan?.tier === "free" ? null : pricingByPlanKey[selectedPlan?.key ?? ""]?.[cadence] ?? null;
    trackProductEvent("plan_selected", {
      market: marketCountry,
      role: currentRole ?? undefined,
      planTier: tier,
      cadence,
      billingSource,
      currency: selectedPricing?.currency ?? undefined,
      amount:
        typeof selectedPricing?.amountMinor === "number"
          ? selectedPricing.amountMinor / 100
          : undefined,
      provider: "stripe",
    });
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

  const startProviderCheckout = async (provider: "paystack" | "flutterwave", tier: PlanTier) => {
    const selectedPlan = SUBSCRIPTION_PLAN_CARDS.find(
      (plan) => plan.tier === tier && (plan.role ? plan.role === currentRole : true)
    );
    const selectedPricing =
      selectedPlan?.tier === "free" ? null : pricingByPlanKey[selectedPlan?.key ?? ""]?.[cadence] ?? null;
    trackProductEvent("plan_selected", {
      market: marketCountry,
      role: currentRole ?? undefined,
      planTier: tier,
      cadence,
      billingSource,
      currency: selectedPricing?.currency ?? undefined,
      amount:
        typeof selectedPricing?.amountMinor === "number"
          ? selectedPricing.amountMinor / 100
          : undefined,
      provider,
    });
    setLoadingKey(`${provider}:${tier}`);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/billing/${provider}/initialize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, cadence }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Unable to start ${provider} checkout.`);
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        setError(`${provider} did not return a checkout URL.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to start ${provider} checkout.`);
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

  useEffect(() => {
    if (verificationRan.current) return;
    const provider = searchParams.get("provider");
    if (!provider) return;

    const reference = searchParams.get("reference") || searchParams.get("trxref");
    const txRef = searchParams.get("tx_ref") || reference;
    const transactionId = searchParams.get("transaction_id");

    if (provider === "paystack" && !reference) return;
    if (provider === "flutterwave" && !txRef) return;

    verificationRan.current = true;
    setVerifying(true);
    setError(null);
    setNotice(null);

    const verify = async () => {
      try {
        const res = await fetch(`/api/billing/${provider}/verify`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            provider === "paystack"
              ? { reference }
              : { tx_ref: txRef, transaction_id: transactionId }
          ),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || "Payment verification failed.");
        } else {
          const status = data?.status || "verified";
          setNotice(
            status === "skipped"
              ? "Payment captured, but manual billing override is active."
              : "Payment verified. Your plan will update shortly."
          );
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment verification failed.");
      } finally {
        setVerifying(false);
        router.replace("/dashboard/billing#plans");
      }
    };

    void verify();
  }, [router, searchParams]);

  return (
    <div className="space-y-6" id="plans">
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Billing interval
          </p>
          <h2 className="text-lg font-semibold text-slate-900">Choose how you want to pay</h2>
          <p className="mt-1 text-sm text-slate-500">
            Pricing is shown for {marketLabel}.
          </p>
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

      {marketDrifted ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            Your active market changed to {market.country} ({market.currency}).
          </p>
          <p className="mt-1">
            Refresh billing to load the matching subscription prices before checkout.
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-2 text-sm font-semibold underline underline-offset-4"
          >
            Refresh pricing
          </button>
        </div>
      ) : null}

      {!marketDrifted && marketChargeDisclosure ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            marketChargeDisclosure.tone === "warning"
              ? "border border-amber-200 bg-amber-50 text-amber-900"
              : "border border-cyan-200 bg-cyan-50 text-cyan-900"
          }`}
        >
          <p className="font-semibold">{marketChargeDisclosure.title}</p>
          <p className="mt-1">{marketChargeDisclosure.body}</p>
        </div>
      ) : null}

      {!marketDrifted && activeQuote?.status === "unavailable" && activeQuote.unavailableReason ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold">Subscription checkout is unavailable in this market.</p>
          <p className="mt-1">{activeQuote.unavailableReason}</p>
        </div>
      ) : null}

      {limitReached && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            {currentRole === "tenant"
              ? `You are at your saved search limit (${savedSearchCount}/${tenantPlan?.maxSavedSearches ?? 0}).`
              : `You are at your listing limit (${activeCount}/${maxListings}).`}
          </p>
          <p className="mt-1">
            {currentRole === "tenant"
              ? "Upgrade to unlock unlimited searches and instant alerts."
              : "Upgrade to publish more listings without delays."}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {SUBSCRIPTION_PLAN_CARDS.map((plan) => {
          const pricing = plan.tier === "free" ? null : pricingByPlanKey[plan.key]?.[cadence] ?? null;
          const priceLabel =
            plan.tier === "free"
              ? "Free"
              : pricing?.status === "ready"
              ? `${pricing.displayPrice} / ${cadence === "monthly" ? "month" : "year"}`
              : "Unavailable";
          const pairedPricing = plan.tier === "free" ? null : pricingByPlanKey[plan.key] ?? null;
          const yearlySavings =
            cadence === "yearly" && pairedPricing ? resolveYearlySavingsLabel(pairedPricing) : null;

          return (
            <PlanCard
              key={plan.key}
              plan={plan}
              priceLabel={priceLabel}
              priceSubLabel={plan.tier !== "free" ? yearlySavings : null}
              pricing={pricing}
              cadenceLabel={cadenceLabel}
              currentTier={currentTier}
              currentRole={currentRole}
              billingSource={billingSource}
              stripeManageAvailable={showManage}
              paystackMode={paystackMode}
              flutterwaveMode={flutterwaveMode}
              pendingUpgrade={pendingUpgrade}
              loadingKey={loadingKey}
              usageCount={plan.usageType === "saved_searches" ? savedSearchCount : activeCount}
              marketDrifted={marketDrifted}
              onUpgrade={startCheckout}
              onPaystack={(tier) => startProviderCheckout("paystack", tier)}
              onFlutterwave={
                flutterwaveCheckoutVisible
                  ? (tier) => startProviderCheckout("flutterwave", tier)
                  : undefined
              }
              onManage={openPortal}
              requestUpgradeAction={requestUpgradeAction}
            />
          );
        })}
      </div>

      {(statusLabel || lifecycleDetail) && (
        <p className="text-xs text-slate-500">
          Lifecycle: {lifecycleLabel}
          {lifecycleDetail ? ` • ${lifecycleDetail}` : ""}
          {statusLabel ? ` • Stripe status: ${statusLabel}` : ""}
          {periodLabel && !lifecycleDetail ? ` • Renews ${periodLabel}` : ""}
        </p>
      )}

      {verifying && <p className="text-sm text-slate-500">Verifying payment…</p>}
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
