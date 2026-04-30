"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MARKET_OPTIONS } from "@/lib/market/market";
import {
  PROPERTY_REQUEST_BEDROOM_OPTIONS,
  PROPERTY_REQUEST_INTENTS,
  PROPERTY_REQUEST_PROPERTY_TYPE_OPTIONS,
  shouldShowPropertyRequestBedrooms,
} from "@/lib/requests/property-requests";
import type { PropertyRequestAlertSubscription } from "@/lib/requests/property-request-alert-subscriptions";

type Props = {
  initialSubscriptions: PropertyRequestAlertSubscription[];
  role: "agent" | "landlord";
};

type FormState = {
  marketCode: string;
  intent: "" | (typeof PROPERTY_REQUEST_INTENTS)[number];
  propertyType: string;
  city: string;
  bedroomsMin: string;
};

const initialFormState: FormState = {
  marketCode: MARKET_OPTIONS[0]?.country ?? "NG",
  intent: "",
  propertyType: "",
  city: "",
  bedroomsMin: "",
};

function formatCriteria(subscription: PropertyRequestAlertSubscription) {
  const parts: string[] = [subscription.marketCode];
  if (subscription.intent) parts.push(subscription.intent);
  if (subscription.propertyType) parts.push(subscription.propertyType);
  if (subscription.city) parts.push(subscription.city);
  if (typeof subscription.bedroomsMin === "number") {
    parts.push(`${subscription.bedroomsMin}+ bedrooms`);
  }
  return parts.join(" • ");
}

function parseBedroomsMin(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function PropertyRequestAlertSubscriptionsManager({ initialSubscriptions, role }: Props) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const showBedrooms =
    form.propertyType === "" || shouldShowPropertyRequestBedrooms(form.propertyType || null);

  async function createSubscription() {
    setPending(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/requests/alert-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        marketCode: form.marketCode,
        intent: form.intent || null,
        propertyType: form.propertyType || null,
        city: form.city.trim() || null,
        bedroomsMin: showBedrooms ? parseBedroomsMin(form.bedroomsMin) : null,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { subscription?: PropertyRequestAlertSubscription; error?: string }
      | null;

    if (!response.ok || !payload?.subscription) {
      setError(payload?.error || "Unable to save request alert subscription.");
      setPending(false);
      return;
    }

    setSubscriptions((current) => {
      const withoutCurrent = current.filter((item) => item.id !== payload.subscription?.id);
      return [payload.subscription as PropertyRequestAlertSubscription, ...withoutCurrent];
    });
    setForm(initialFormState);
    setNotice("Request alert saved.");
    setPending(false);
  }

  async function deleteSubscription(id: string) {
    setPending(true);
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/requests/alert-subscriptions/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error || "Unable to remove request alert subscription.");
      setPending(false);
      return;
    }

    setSubscriptions((current) => current.filter((item) => item.id !== id));
    setNotice("Request alert removed.");
    setPending(false);
  }

  return (
    <section
      id="request-alerts"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="property-request-alert-subscriptions-manager"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Property request alerts</h2>
        <p className="text-sm text-slate-600">
          Create opt-in alerts for new published requests that match your supply focus. Contact details stay private until the response flow.
        </p>
        <p className="text-xs text-slate-500">
          Available for {role === "agent" ? "agents" : "landlords"} only. Alerts deliver by email when a newly published request matches the criteria below.
        </p>
      </div>

      {notice ? (
        <Alert
          className="mt-3"
          title="Updated"
          description={notice}
          variant="success"
        />
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Market
          </span>
          <Select
            value={form.marketCode}
            onChange={(event) => setForm((current) => ({ ...current, marketCode: event.target.value }))}
          >
            {MARKET_OPTIONS.map((option) => (
              <option key={option.country} value={option.country}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Intent
          </span>
          <Select
            value={form.intent}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                intent: event.target.value as FormState["intent"],
              }))
            }
          >
            <option value="">All intents</option>
            <option value="rent">Rent</option>
            <option value="buy">Buy</option>
            <option value="shortlet">Shortlet</option>
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Property type
          </span>
          <Select
            value={form.propertyType}
            onChange={(event) => setForm((current) => ({ ...current, propertyType: event.target.value }))}
          >
            {PROPERTY_REQUEST_PROPERTY_TYPE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            City
          </span>
          <Input
            value={form.city}
            onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
            placeholder="Lagos"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Min bedrooms
          </span>
          <Select
            value={showBedrooms ? form.bedroomsMin : ""}
            disabled={!showBedrooms}
            onChange={(event) => setForm((current) => ({ ...current, bedroomsMin: event.target.value }))}
          >
            {PROPERTY_REQUEST_BEDROOM_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.value === "" ? "Any bedrooms" : `${option.value}+ bedrooms`}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button disabled={pending} onClick={() => void createSubscription()}>
          {pending ? "Saving..." : "Create alert"}
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-sm font-semibold text-slate-900">Current request alerts</p>
        {subscriptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-slate-600">
            No request alerts yet. Create one to receive matching published demand by email.
          </div>
        ) : (
          subscriptions.map((subscription) => (
            <div
              key={subscription.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4"
              data-testid="property-request-alert-subscription-row"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{formatCriteria(subscription)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Created {new Date(subscription.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => void deleteSubscription(subscription.id)}
              >
                Remove
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
