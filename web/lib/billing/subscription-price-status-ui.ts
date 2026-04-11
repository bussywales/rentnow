import type { SubscriptionPriceRowStatus } from "@/lib/billing/subscription-price-book";

export type SubscriptionPriceStatusTone = {
  className: string;
  categoryLabel: "Good" | "Info" | "Warning" | "Blocking";
};

export function getSubscriptionControlStatusTone(status: SubscriptionPriceRowStatus): SubscriptionPriceStatusTone {
  if (status === "active") {
    return {
      className: "border border-emerald-200 bg-emerald-50 text-emerald-700",
      categoryLabel: "Good",
    };
  }

  if (status === "draft" || status === "pending_publish" || status === "archived") {
    return {
      className: "border border-sky-200 bg-sky-50 text-sky-700",
      categoryLabel: "Info",
    };
  }

  if (status === "missing_stripe_ref") {
    return {
      className: "border border-amber-200 bg-amber-50 text-amber-700",
      categoryLabel: "Warning",
    };
  }

  return {
    className: "border border-rose-200 bg-rose-50 text-rose-700",
    categoryLabel: "Blocking",
  };
}

export function getSubscriptionDiagnosticTone(label: string): SubscriptionPriceStatusTone {
  if (label === "Aligned") {
    return {
      className: "border border-emerald-200 bg-emerald-50 text-emerald-700",
      categoryLabel: "Good",
    };
  }

  if (
    label === "Canonical runtime" ||
    label === "Provider-backed runtime" ||
    label === "Superseded row history" ||
    label === "Pending publish"
  ) {
    return {
      className: "border border-sky-200 bg-sky-50 text-sky-700",
      categoryLabel: "Info",
    };
  }

  if (
    label === "Missing Stripe ref" ||
    label === "Missing provider ref" ||
    label === "Cross-currency canonical" ||
    label === "Provider fallback in use"
  ) {
    return {
      className: "border border-amber-200 bg-amber-50 text-amber-700",
      categoryLabel: "Warning",
    };
  }

  return {
    className: "border border-rose-200 bg-rose-50 text-rose-700",
    categoryLabel: "Blocking",
  };
}
