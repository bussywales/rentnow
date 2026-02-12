import { getFeaturedEligibilitySettings } from "@/lib/featured/eligibility.server";

export type FeaturedPaymentPlan = "featured_7d" | "featured_30d";

export type FeaturedPaymentProduct = {
  plan: FeaturedPaymentPlan;
  durationDays: 7 | 30;
  amountMinor: number;
  currency: string;
};

function normalizeCurrency(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "NGN";
  if (!/^[A-Z]{3}$/.test(normalized)) return "NGN";
  return normalized;
}

export function buildFeaturedProductsFromSettings(input: {
  price7dMinor: number;
  price30dMinor: number;
  currency: string;
}) {
  const currency = normalizeCurrency(input.currency);
  const price7dMinor = Math.max(0, Math.trunc(input.price7dMinor || 0));
  const price30dMinor = Math.max(0, Math.trunc(input.price30dMinor || 0));

  const products: Record<FeaturedPaymentPlan, FeaturedPaymentProduct> = {
    featured_7d: {
      plan: "featured_7d",
      durationDays: 7,
      amountMinor: price7dMinor,
      currency,
    },
    featured_30d: {
      plan: "featured_30d",
      durationDays: 30,
      amountMinor: price30dMinor,
      currency,
    },
  };
  return products;
}

export async function getFeaturedProducts() {
  const settings = await getFeaturedEligibilitySettings();
  return buildFeaturedProductsFromSettings({
    price7dMinor: settings.price7dMinor,
    price30dMinor: settings.price30dMinor,
    currency: settings.currency,
  });
}

export async function getFeaturedProductByPlan(plan: FeaturedPaymentPlan) {
  const products = await getFeaturedProducts();
  return products[plan];
}

export function formatMinor(currency: string, amountMinor: number, locale = "en-NG") {
  const amount = Number.isFinite(amountMinor) ? amountMinor / 100 : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizeCurrency(currency),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${normalizeCurrency(currency)} ${amount.toFixed(2)}`;
  }
}
