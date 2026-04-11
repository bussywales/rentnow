"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { BillingCadence, BillingRole } from "@/lib/billing/stripe-plans";
import type {
  AdminSubscriptionPriceAuditEntry,
  AdminSubscriptionPriceDraftView,
} from "@/lib/billing/subscription-price-control-plane.server";
import type { SubscriptionPriceMatrixEntry } from "@/lib/billing/subscription-price-book";

const MARKET_OPTIONS = [
  { country: "GB", currency: "GBP", label: "United Kingdom (GB£)" },
  { country: "CA", currency: "CAD", label: "Canada (CA$)" },
  { country: "US", currency: "USD", label: "United States (US$)" },
];

const ROLE_OPTIONS: Array<{ role: BillingRole; label: string }> = [
  { role: "tenant", label: "Tenant" },
  { role: "landlord", label: "Landlord" },
  { role: "agent", label: "Agent" },
];

const CADENCE_OPTIONS: BillingCadence[] = ["monthly", "yearly"];

function formatMinorAsMajor(amountMinor: number) {
  return (amountMinor / 100).toFixed(2);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toneClasses(status: AdminSubscriptionPriceDraftView["status"]) {
  if (status === "pending_publish" || status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "missing_stripe_ref" || status === "misaligned") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "blocked") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-600";
}

type Props = {
  drafts: AdminSubscriptionPriceDraftView[];
  activity: AdminSubscriptionPriceAuditEntry[];
  activeEntries: SubscriptionPriceMatrixEntry[];
};

export default function AdminSubscriptionPricingControlPlane({ drafts, activity, activeEntries }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(drafts[0]?.id ?? null);
  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? null;

  const activeEntriesByKey = useMemo(
    () =>
      Object.fromEntries(
        activeEntries.map((entry) => [entry.key, entry])
      ) as Record<string, SubscriptionPriceMatrixEntry>,
    [activeEntries]
  );

  const defaultMarket = MARKET_OPTIONS[0];
  const [marketCountry, setMarketCountry] = useState(selectedDraft?.marketCountry ?? defaultMarket.country);
  const [role, setRole] = useState<BillingRole>(selectedDraft?.role ?? "landlord");
  const [cadence, setCadence] = useState<BillingCadence>(selectedDraft?.cadence ?? "monthly");
  const [currency, setCurrency] = useState(selectedDraft?.currency ?? defaultMarket.currency);
  const [amountMajor, setAmountMajor] = useState(selectedDraft ? formatMinorAsMajor(selectedDraft.amountMinor) : "19.99");
  const [providerPriceRef, setProviderPriceRef] = useState(selectedDraft?.providerPriceRef ?? "");
  const [operatorNotes, setOperatorNotes] = useState(selectedDraft?.operatorNotes ?? "");

  const formKey = `${marketCountry}:${role}:${cadence}`;
  const activeEntry = activeEntriesByKey[formKey] ?? null;

  const resetFromDraft = (draft: AdminSubscriptionPriceDraftView | null) => {
    const fallbackMarket = MARKET_OPTIONS.find((option) => option.country === draft?.marketCountry) ?? defaultMarket;
    setSelectedDraftId(draft?.id ?? null);
    setMarketCountry(draft?.marketCountry ?? fallbackMarket.country);
    setRole(draft?.role ?? "landlord");
    setCadence(draft?.cadence ?? "monthly");
    setCurrency(draft?.currency ?? fallbackMarket.currency);
    setAmountMajor(draft ? formatMinorAsMajor(draft.amountMinor) : "19.99");
    setProviderPriceRef(draft?.providerPriceRef ?? "");
    setOperatorNotes(draft?.operatorNotes ?? "");
  };

  const handleMarketChange = (country: string) => {
    const market = MARKET_OPTIONS.find((option) => option.country === country) ?? defaultMarket;
    setMarketCountry(country);
    setCurrency(market.currency);
  };

  const handleSaveDraft = () => {
    const numericAmount = Number(amountMajor);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setError("Enter a valid amount before saving the pricing draft.");
      return;
    }

    setError(null);
    setToast(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/billing/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_draft",
          marketCountry,
          role,
          cadence,
          currency,
          amountMinor: Math.round(numericAmount * 100),
          providerPriceRef: providerPriceRef.trim() || null,
          operatorNotes: operatorNotes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to save pricing draft.");
        return;
      }
      setToast(
        data?.stripePriceInvalidated
          ? "Pricing draft saved. Existing Stripe price binding was cleared because the billing terms changed."
          : "Pricing draft saved."
      );
      router.refresh();
    });
  };

  const handleCreateStripePrice = (draftId: string) => {
    setError(null);
    setToast(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/billing/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_stripe_price", draftId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to create the Stripe recurring price.");
        return;
      }
      setToast(`Stripe recurring price created and bound: ${data?.providerPriceRef || "price created"}.`);
      router.refresh();
    });
  };

  const handlePublish = (draftId: string) => {
    setError(null);
    setToast(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/billing/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", draftId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to publish pricing draft.");
        return;
      }
      setToast("Pricing published. The new canonical row is now live.");
      router.refresh();
    });
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Pricing control plane</p>
            <p className="mt-1 text-sm text-slate-600">
              Manage Stripe-backed subscription pricing as drafts first, then publish a new canonical live state when the linked Stripe recurring price is ready.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Stripe-backed subscription pricing MVP
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Draft pricing</p>
              <Button size="sm" variant="secondary" onClick={() => resetFromDraft(null)} disabled={pending}>
                New draft
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Normal price changes should start here, not in Stripe and not in a migration.
            </p>
            <div className="mt-3 space-y-2">
              {drafts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                  No pricing drafts yet.
                </div>
              ) : (
                drafts.map((draft) => (
                  <button
                    key={draft.id}
                    type="button"
                    onClick={() => resetFromDraft(draft)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      selectedDraftId === draft.id
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {draft.marketCountry} · {draft.roleLabel} · {draft.cadence}
                        </p>
                        <p className="text-xs text-slate-500">
                          Draft {draft.displayPrice}
                          {draft.replacingDisplayPrice ? ` replacing ${draft.replacingDisplayPrice}` : ""}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${toneClasses(draft.status)}`}>
                        {draft.statusLabel}
                      </span>
                    </div>
                    {draft.statusDetail ? <p className="mt-2 text-xs text-slate-600">{draft.statusDetail}</p> : null}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Draft editor</p>
            <p className="mt-1 text-xs text-slate-600">
              Set the canonical price first. Create and bind a Stripe recurring price from this draft, then publish only when the draft is ready.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Market</span>
                <select value={marketCountry} onChange={(event) => handleMarketChange(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  {MARKET_OPTIONS.map((option) => (
                    <option key={option.country} value={option.country}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Role</span>
                <select value={role} onChange={(event) => setRole(event.target.value as BillingRole)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.role} value={option.role}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Cadence</span>
                <select value={cadence} onChange={(event) => setCadence(event.target.value as BillingCadence)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  {CADENCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Currency</span>
                <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase" />
              </label>
              <label className="text-sm text-slate-700 md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Amount</span>
                <input value={amountMajor} onChange={(event) => setAmountMajor(event.target.value)} inputMode="decimal" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="19.99" />
              </label>
              <label className="text-sm text-slate-700 md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Stripe recurring price ref</span>
                <input value={providerPriceRef} onChange={(event) => setProviderPriceRef(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="price_xxx" />
              </label>
              <label className="text-sm text-slate-700 md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Operator note</span>
                <textarea value={operatorNotes} onChange={(event) => setOperatorNotes(event.target.value)} rows={4} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Why this price is changing, launch date, or Stripe ref context." />
              </label>
            </div>

            {activeEntry ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Current live row</p>
                <p className="mt-1">
                  {activeEntry.marketCountry} · {activeEntry.roleLabel} · {activeEntry.cadence} · {activeEntry.canonicalDisplayPrice || "—"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Provider {activeEntry.canonicalProvider || "—"}
                  {activeEntry.canonicalProviderRef ? ` · ${activeEntry.canonicalProviderRef}` : " · Missing ref"}
                </p>
              </div>
            ) : null}

            {selectedDraft ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Stripe execution state</p>
                <p className="mt-1">
                  {selectedDraft.providerPriceRef
                    ? `Bound to ${selectedDraft.providerPriceRef}.`
                    : "Draft only. No Stripe recurring price is bound yet."}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  If you change the amount, currency, or cadence after binding a Stripe price, save the draft again. The old binding will be cleared and a new Stripe price will be required.
                </p>
              </div>
            ) : null}

            {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            {toast ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{toast}</p> : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={handleSaveDraft} disabled={pending}>{pending ? "Saving..." : "Save draft"}</Button>
              {selectedDraft ? (
                <Button
                  variant="secondary"
                  onClick={() => handleCreateStripePrice(selectedDraft.id)}
                  disabled={pending || selectedDraft.status === "pending_publish"}
                >
                  {pending
                    ? "Creating..."
                    : selectedDraft.providerPriceRef
                    ? "Create replacement Stripe price"
                    : "Create Stripe price"}
                </Button>
              ) : null}
              {selectedDraft ? (
                <Button variant="secondary" onClick={() => handlePublish(selectedDraft.id)} disabled={pending || selectedDraft.status !== "pending_publish"}>
                  {pending ? "Publishing..." : "Publish draft"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Recent pricing activity</p>
        <p className="mt-1 text-xs text-slate-600">
          Shows what changed, when, who changed it, and the before/after canonical values.
        </p>
        <div className="mt-4 space-y-3">
          {activity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No pricing activity recorded yet.
            </div>
          ) : (
            activity.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {item.marketCountry} · {item.roleLabel} · {item.cadence} · {item.eventType.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {item.actorLabel || "Unknown admin"} · {item.provider}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {item.previousDisplayPrice ? `Previous: ${item.previousDisplayPrice}` : "Previous: none"}
                  {" → "}
                  {item.nextDisplayPrice ? `Next: ${item.nextDisplayPrice}` : "Next: —"}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
