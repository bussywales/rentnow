"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { MARKET_OPTIONS } from "@/lib/market/market";
import {
  MOVE_READY_SERVICE_CATEGORIES,
  MOVE_READY_SERVICE_CATEGORY_DESCRIPTIONS,
  MOVE_READY_SERVICE_CATEGORY_LABELS,
  type MoveReadyEntrypointSource,
  type MoveReadyServiceCategory,
} from "@/lib/services/move-ready";

type HostPropertyOption = {
  id: string;
  title: string;
  city: string | null;
  area: string | null;
  marketCode: string | null;
};

type Props = {
  properties: HostPropertyOption[];
  defaultMarketCode: string;
  defaultPropertyId?: string | null;
  entrypointSource: MoveReadyEntrypointSource;
};

export function MoveReadyRequestForm({
  properties,
  defaultMarketCode,
  defaultPropertyId = null,
  entrypointSource,
}: Props) {
  const router = useRouter();
  const propertyMap = useMemo(() => new Map(properties.map((item) => [item.id, item])), [properties]);
  const [category, setCategory] = useState<MoveReadyServiceCategory>("end_of_tenancy_cleaning");
  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [marketCode, setMarketCode] = useState(defaultMarketCode);
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [preferredTimingText, setPreferredTimingText] = useState("");
  const [contactPreference, setContactPreference] = useState<"phone" | "email">("email");
  const [contextNotes, setContextNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePropertyChange(nextPropertyId: string) {
    setPropertyId(nextPropertyId);
    const selected = nextPropertyId ? propertyMap.get(nextPropertyId) ?? null : null;
    if (!selected) return;
    if (selected.marketCode) setMarketCode(selected.marketCode);
    if (selected.city) setCity(selected.city);
    if (selected.area) setArea(selected.area);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/services/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        propertyId: propertyId || null,
        marketCode,
        city: city || null,
        area: area || null,
        preferredTimingText: preferredTimingText || null,
        contactPreference,
        contextNotes,
        entrypointSource,
      }),
    }).catch(() => null);

    setSubmitting(false);

    if (!response) {
      setError("Unable to submit the request right now.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; requestId?: string }
      | null;

    if (!response.ok || !payload?.requestId) {
      setError(payload?.error || "Unable to submit the request right now.");
      return;
    }

    router.push(`/host/services/requests/${payload.requestId}?created=1`);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} data-testid="move-ready-request-form">
      {error ? <Alert variant="error" title="Request not sent" description={error} /> : null}

      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Choose the job</p>
          <p className="text-sm text-slate-600">
            Keep this narrow: cleaning, fumigation, or minor repairs tied to the property.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {MOVE_READY_SERVICE_CATEGORIES.map((item) => {
            const active = category === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-sky-300 bg-sky-50 text-sky-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <p className="font-semibold">{MOVE_READY_SERVICE_CATEGORY_LABELS[item]}</p>
                <p className="mt-2 text-sm">{MOVE_READY_SERVICE_CATEGORY_DESCRIPTIONS[item]}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Linked property
          <select
            value={propertyId}
            onChange={(event) => handlePropertyChange(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            <option value="">No linked property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.title}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm font-medium text-slate-700">
          Market
          <select
            value={marketCode}
            onChange={(event) => setMarketCode(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            {MARKET_OPTIONS.map((option) => (
              <option key={option.country} value={option.country}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm font-medium text-slate-700">
          City
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            placeholder="e.g. Lagos"
          />
        </label>

        <label className="space-y-1 text-sm font-medium text-slate-700">
          Area
          <input
            value={area}
            onChange={(event) => setArea(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            placeholder="e.g. Lekki Phase 1"
          />
        </label>

        <label className="space-y-1 text-sm font-medium text-slate-700">
          Preferred timing
          <input
            value={preferredTimingText}
            onChange={(event) => setPreferredTimingText(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            placeholder="e.g. Within 3 days"
          />
        </label>

        <label className="space-y-1 text-sm font-medium text-slate-700">
          Contact preference
          <select
            value={contactPreference}
            onChange={(event) => setContactPreference(event.target.value as "phone" | "email")}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
        </label>
      </section>

      <label className="block space-y-1 text-sm font-medium text-slate-700">
        Property-prep notes
        <textarea
          value={contextNotes}
          onChange={(event) => setContextNotes(event.target.value)}
          className="min-h-[160px] w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-900"
          placeholder="What needs doing, what is blocking the next tenant or guest, and any access constraints."
          required
        />
      </label>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Manual routing posture</p>
        <p className="mt-1 text-amber-800">
          This request is routed to vetted providers only. If no provider fits the area and category,
          the request is left unmatched for operator follow-up instead of pretending the job is covered.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending request..." : "Send request"}
        </Button>
      </div>
    </form>
  );
}
