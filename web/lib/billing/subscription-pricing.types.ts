import type { BillingCadence } from "@/lib/billing/stripe-plans";

export type SubscriptionCheckoutProvider = "stripe" | "paystack" | "flutterwave";

export type SubscriptionPlanPricingView = {
  status: "ready" | "unavailable";
  source: "canonical" | "legacy";
  provider: SubscriptionCheckoutProvider | null;
  providerMode: string | null;
  currency: string | null;
  amountMinor: number | null;
  displayPrice: string;
  cadence: BillingCadence;
  marketCountry: string;
  marketCurrency: string;
  marketLabel: string;
  marketAligned: boolean;
  fallbackApplied: boolean;
  fallbackMessage: string | null;
  unavailableReason: string | null;
  resolutionKey: string | null;
  priceId: string | null;
};

export type SubscriptionPlanPricingSet = {
  monthly: SubscriptionPlanPricingView;
  yearly: SubscriptionPlanPricingView;
};
