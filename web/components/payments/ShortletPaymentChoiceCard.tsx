"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type InitPayload = {
  booking_id: string;
};

type InitResponse = {
  authorization_url?: string;
  checkout_url?: string;
  error?: string;
};

async function initCheckout(endpoint: string, payload: InitPayload) {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as InitResponse;
  if (!response.ok) {
    throw new Error(data.error || "Unable to initialize checkout");
  }
  const url = data.checkout_url || data.authorization_url;
  if (!url) {
    throw new Error("Checkout URL is missing");
  }
  return url;
}

export function ShortletPaymentChoiceCard(props: {
  bookingId: string;
  primaryProvider: "stripe" | "paystack";
  stripe: { enabled: boolean; reason: string | null };
  paystack: { enabled: boolean; reason: string | null };
}) {
  const [busyProvider, setBusyProvider] = useState<"stripe" | "paystack" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStripe() {
    if (busyProvider) return;
    setBusyProvider("stripe");
    setError(null);
    try {
      const url = await initCheckout("/api/shortlet/payments/stripe/init", {
        booking_id: props.bookingId,
      });
      window.location.assign(url);
    } catch (initError) {
      setError(initError instanceof Error ? initError.message : "Unable to initialize Stripe checkout");
      setBusyProvider(null);
    }
  }

  async function handlePaystack() {
    if (busyProvider) return;
    setBusyProvider("paystack");
    setError(null);
    try {
      const url = await initCheckout("/api/shortlet/payments/paystack/init", {
        booking_id: props.bookingId,
      });
      window.location.assign(url);
    } catch (initError) {
      setError(initError instanceof Error ? initError.message : "Unable to initialize Paystack checkout");
      setBusyProvider(null);
    }
  }

  const methods: Array<{
    key: "paystack" | "stripe";
    label: string;
    loadingLabel: string;
    onClick: () => Promise<void>;
    enabled: boolean;
    reason: string | null;
    buttonVariant?: "primary" | "secondary";
  }> =
    props.primaryProvider === "paystack"
      ? [
          {
            key: "paystack",
            label: "Pay with Paystack",
            loadingLabel: "Redirecting to Paystack...",
            onClick: handlePaystack,
            enabled: props.paystack.enabled,
            reason: props.paystack.reason,
            buttonVariant: "primary",
          },
          {
            key: "stripe",
            label: "Pay by card (Stripe)",
            loadingLabel: "Redirecting to Stripe...",
            onClick: handleStripe,
            enabled: props.stripe.enabled,
            reason: props.stripe.reason,
            buttonVariant: "secondary",
          },
        ]
      : [
          {
            key: "stripe",
            label: "Pay by card (Stripe)",
            loadingLabel: "Redirecting to Stripe...",
            onClick: handleStripe,
            enabled: props.stripe.enabled,
            reason: props.stripe.reason,
            buttonVariant: "primary",
          },
          {
            key: "paystack",
            label: "Pay with Nigerian methods (Paystack)",
            loadingLabel: "Redirecting to Paystack...",
            onClick: handlePaystack,
            enabled: props.paystack.enabled,
            reason: props.paystack.reason,
            buttonVariant: "secondary",
          },
        ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Shortlet checkout</p>
      <h1 className="mt-1 text-xl font-semibold text-slate-900">Choose a payment method</h1>
      <p className="mt-1 text-sm text-slate-600">
        Complete payment to confirm this booking in your Trips.
      </p>

      <div className="mt-4 grid gap-3">
        {methods.map((method) => (
          <div key={method.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold uppercase tracking-[0.08em] text-slate-700">
                {method.key === props.primaryProvider ? "Primary method" : "Alternative"}
              </span>
              <span className={method.enabled ? "text-emerald-700" : "text-slate-600"}>
                {method.enabled ? "Available now" : "Unavailable"}
              </span>
            </div>
            <Button
              variant={method.buttonVariant === "secondary" ? "secondary" : "primary"}
              onClick={method.onClick}
              disabled={!method.enabled || !!busyProvider}
            >
              {busyProvider === method.key ? method.loadingLabel : method.label}
            </Button>
            {method.reason ? <p className="mt-2 text-xs text-slate-600">{method.reason}</p> : null}
          </div>
        ))}
      </div>

      {!props.stripe.enabled && !props.paystack.enabled ? (
        <p className="mt-2 text-sm text-rose-600">
          Payments are not available for this listing right now.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Link href={`/trips/${props.bookingId}`} className="text-sm font-semibold text-sky-700 underline underline-offset-2">
          View trip
        </Link>
        <Link href="/trips" className="text-sm font-semibold text-slate-700 underline underline-offset-2">
          Back to trips
        </Link>
      </div>
    </section>
  );
}
