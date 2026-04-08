"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { MARKET_OPTIONS } from "@/lib/market/market";
import {
  MOVE_READY_SERVICE_CATEGORIES,
  MOVE_READY_SERVICE_CATEGORY_LABELS,
  formatMoveReadyAreaLine,
  parseMoveReadyAreaLines,
} from "@/lib/services/move-ready";

type ProviderListItem = {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string | null;
  verificationState: string;
  providerStatus: string;
  categories: string[];
  serviceAreas: Array<{ marketCode: string; city: string | null; area: string | null }>;
  notes: string | null;
};

type Props = {
  providers: ProviderListItem[];
};

export function AdminMoveReadyProviderManager({ providers }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "end_of_tenancy_cleaning",
  ]);
  const [marketCode, setMarketCode] = useState("NG");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");

  async function createProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const response = await fetch("/api/admin/services/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName,
        contactName,
        email,
        phone: phone || null,
        verificationState: "approved",
        providerStatus: "active",
        categories: selectedCategories,
        serviceAreas: parseMoveReadyAreaLines(`${marketCode} | ${city} | ${area}`),
        notes: notes || null,
      }),
    }).catch(() => null);

    setSaving(false);
    if (!response || !response.ok) {
      setMessage("Provider not created.");
      return;
    }

    setMessage("Provider created. Refresh to see the updated queue.");
    setBusinessName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setArea("");
    setCity("");
  }

  async function updateProvider(providerId: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/admin/services/providers/${providerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!response || !response.ok) {
      setMessage("Provider update failed.");
      return;
    }

    setMessage("Provider updated. Refresh to confirm the latest state.");
  }

  return (
    <div className="space-y-6">
      {message ? <Alert variant="info" title="Move & Ready admin" description={message} /> : null}

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4" onSubmit={createProvider}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Add vetted provider</h2>
          <p className="text-sm text-slate-600">
            Curated onboarding only. This is not open self-serve provider growth.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Business name
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" required />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Contact name
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" required />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" required />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Market
            <select value={marketCode} onChange={(e) => setMarketCode(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
              {MARKET_OPTIONS.map((option) => (
                <option key={option.country} value={option.country}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" required />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
            Area
            <input value={area} onChange={(e) => setArea(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Optional narrower area" />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Approved categories</p>
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

        <label className="block space-y-1 text-sm font-medium text-slate-700">
          Internal notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[100px] w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>

        <Button type="submit" disabled={saving || selectedCategories.length === 0}>
          {saving ? "Saving..." : "Create provider"}
        </Button>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Provider queue</h2>
            <p className="text-sm text-slate-600">Approve, reject, or pause curated providers.</p>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {providers.map((provider) => (
            <div key={provider.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{provider.businessName}</p>
                    <p className="text-sm text-slate-600">
                      {provider.contactName} · {provider.email}
                      {provider.phone ? ` · ${provider.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                      Verification {provider.verificationState}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                      Status {provider.providerStatus}
                    </span>
                    {provider.categories.map((category) => (
                      <span key={category} className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-800">
                        {MOVE_READY_SERVICE_CATEGORY_LABELS[category as keyof typeof MOVE_READY_SERVICE_CATEGORY_LABELS] || category}
                      </span>
                    ))}
                  </div>
                  <div className="text-sm text-slate-600">
                    {provider.serviceAreas.map((item) => (
                      <p key={`${item.marketCode}-${item.city}-${item.area}`}>
                        {formatMoveReadyAreaLine(item)}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => updateProvider(provider.id, { verificationState: "approved", providerStatus: "active" })}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => updateProvider(provider.id, { verificationState: "rejected" })}>
                    Reject
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => updateProvider(provider.id, { providerStatus: "paused" })}>
                    Pause
                  </Button>
                </div>
              </div>
              {provider.notes ? <p className="mt-3 text-sm text-slate-600">{provider.notes}</p> : null}
            </div>
          ))}
          {providers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No curated providers have been added yet.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
