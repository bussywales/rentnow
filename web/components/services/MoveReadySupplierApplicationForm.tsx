"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { MARKET_OPTIONS } from "@/lib/market/market";
import {
  MOVE_READY_SERVICE_CATEGORIES,
  MOVE_READY_SERVICE_CATEGORY_LABELS,
} from "@/lib/services/move-ready";

export function MoveReadySupplierApplicationForm() {
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [verificationReference, setVerificationReference] = useState("");
  const [notes, setNotes] = useState("");
  const [marketCode, setMarketCode] = useState("NG");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "end_of_tenancy_cleaning",
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/services/providers/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName,
        contactName,
        email,
        phone: phone || null,
        verificationReference: verificationReference || null,
        notes: notes || null,
        categories: selectedCategories,
        serviceAreas: [
          {
            marketCode,
            city: city || null,
            area: area || null,
          },
        ],
      }),
    }).catch(() => null);

    setSubmitting(false);

    if (!response) {
      setError("Unable to submit supplier application right now.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(payload?.error || "Unable to submit supplier application right now.");
      return;
    }

    setSuccess("Application submitted. PropatyHub reviews coverage and fit before approving suppliers.");
    setBusinessName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setVerificationReference("");
    setNotes("");
    setArea("");
    setCity("");
    setSelectedCategories(["end_of_tenancy_cleaning"]);
  }

  return (
    <form
      className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      onSubmit={handleSubmit}
      data-testid="move-ready-supplier-application-form"
    >
      {error ? <Alert variant="error" title="Application not submitted" description={error} /> : null}
      {success ? <Alert variant="success" title="Application received" description={success} /> : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Property Prep supplier intake
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Apply to join the curated supplier network</h1>
        <p className="text-sm text-slate-600">
          Applications are reviewed before approval. This form does not create a public listing or
          instant customer access.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Business name
          <input
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            required
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Contact name
          <input
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            required
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            type="email"
            required
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Phone
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Primary market
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
            required
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
          Area coverage
          <input
            value={area}
            onChange={(event) => setArea(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            placeholder="Optional narrower area"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Service categories</p>
        <div className="flex flex-wrap gap-2">
          {MOVE_READY_SERVICE_CATEGORIES.map((category) => {
            const active = selectedCategories.includes(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() =>
                  setSelectedCategories((current) =>
                    current.includes(category)
                      ? current.filter((value) => value !== category)
                      : [...current, category]
                  )
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  active
                    ? "border-sky-300 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {MOVE_READY_SERVICE_CATEGORY_LABELS[category]}
              </button>
            );
          })}
        </div>
      </div>

      <label className="space-y-1 text-sm font-medium text-slate-700">
        Company registration or verification reference
        <input
          value={verificationReference}
          onChange={(event) => setVerificationReference(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          placeholder="Optional CAC, RC, licence, or verification reference"
        />
      </label>

      <label className="space-y-1 text-sm font-medium text-slate-700">
        Experience summary
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-[140px] w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-900"
          placeholder="Describe the work you handle, coverage strengths, and any relevant operating detail."
        />
      </label>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Reviewed supplier intake only</p>
        <p className="mt-1 text-amber-800">
          PropatyHub reviews supplier fit by category and geography before routing any customer demand.
          Customer contact details are protected in this workflow.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={submitting || selectedCategories.length === 0}>
          {submitting ? "Submitting application..." : "Submit supplier application"}
        </Button>
      </div>
    </form>
  );
}
