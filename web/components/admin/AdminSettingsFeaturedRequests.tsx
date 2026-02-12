"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { formatFeaturedMinorAmount } from "@/lib/featured/eligibility";

type SettingsState = {
  requestsEnabled: boolean;
  price7dMinor: number;
  price30dMinor: number;
  currency: string;
  reviewSlaDays: number;
  requiresApprovedListing: boolean;
  requiresActiveListing: boolean;
  requiresNotDemo: boolean;
  minPhotos: number;
  minDescriptionChars: number;
};

type Props = {
  settings: SettingsState;
  updatedAt: Record<keyof SettingsState, string | null>;
};

function asMajor(minor: number): string {
  return (minor / 100).toFixed(2);
}

function toMinor(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const integer = Math.trunc(value);
  if (integer < min) return min;
  if (integer > max) return max;
  return integer;
}

export default function AdminSettingsFeaturedRequests({ settings, updatedAt }: Props) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<SettingsState>(settings);
  const [price7dMajor, setPrice7dMajor] = useState(() => asMajor(settings.price7dMinor));
  const [price30dMajor, setPrice30dMajor] = useState(() => asMajor(settings.price30dMinor));
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const currencyOptions = useMemo(() => {
    const unique = new Set(["NGN", "GBP", draft.currency.toUpperCase()]);
    return Array.from(unique);
  }, [draft.currency]);

  const save = () => {
    setError(null);
    setToast(null);

    const payload: SettingsState = {
      ...draft,
      currency: draft.currency.toUpperCase().slice(0, 3) || "NGN",
      price7dMinor: toMinor(price7dMajor),
      price30dMinor: toMinor(price30dMajor),
      reviewSlaDays: clampInt(draft.reviewSlaDays, 1, 30),
      minPhotos: clampInt(draft.minPhotos, 0, 20),
      minDescriptionChars: clampInt(draft.minDescriptionChars, 0, 5000),
    };

    startTransition(async () => {
      try {
        const updates = [
          { key: APP_SETTING_KEYS.featuredRequestsEnabled, value: { enabled: payload.requestsEnabled } },
          { key: APP_SETTING_KEYS.featuredPrice7dMinor, value: { value: payload.price7dMinor } },
          { key: APP_SETTING_KEYS.featuredPrice30dMinor, value: { value: payload.price30dMinor } },
          { key: APP_SETTING_KEYS.featuredCurrency, value: { value: payload.currency } },
          { key: APP_SETTING_KEYS.featuredReviewSlaDays, value: { value: payload.reviewSlaDays } },
          { key: APP_SETTING_KEYS.featuredRequiresApprovedListing, value: { enabled: payload.requiresApprovedListing } },
          { key: APP_SETTING_KEYS.featuredRequiresActiveListing, value: { enabled: payload.requiresActiveListing } },
          { key: APP_SETTING_KEYS.featuredRequiresNotDemo, value: { enabled: payload.requiresNotDemo } },
          { key: APP_SETTING_KEYS.featuredMinPhotos, value: { value: payload.minPhotos } },
          { key: APP_SETTING_KEYS.featuredMinDescriptionChars, value: { value: payload.minDescriptionChars } },
        ];

        for (const update of updates) {
          const response = await fetch("/api/admin/app-settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(update),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data?.error || "Unable to update featured settings.");
          }
        }

        setDraft(payload);
        setPrice7dMajor(asMajor(payload.price7dMinor));
        setPrice30dMajor(asMajor(payload.price30dMinor));
        setToast("Featured request settings saved.");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save featured settings.");
      }
    });
  };

  const preview7d = formatFeaturedMinorAmount(toMinor(price7dMajor), draft.currency || "NGN");
  const preview30d = formatFeaturedMinorAmount(toMinor(price30dMajor), draft.currency || "NGN");
  const lastUpdated = Object.values(updatedAt).find(Boolean) ?? null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Featured (Requests)</h2>
        <p className="text-sm text-slate-600">
          Configure display-only pricing and eligibility guardrails for host featured requests.
        </p>
        <p className="text-xs text-slate-500">
          Display-only pricing until payments go live.
        </p>
        {lastUpdated ? (
          <p className="text-xs text-slate-500">
            Last updated {new Date(lastUpdated).toLocaleString()}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <span className="font-medium text-slate-800">Featured requests enabled</span>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            checked={draft.requestsEnabled}
            onChange={(event) => setDraft((prev) => ({ ...prev, requestsEnabled: event.target.checked }))}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-800">Currency</span>
          <select
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={draft.currency.toUpperCase()}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
            }
          >
            {currencyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-800">7-day price</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={price7dMajor}
            onChange={(event) => setPrice7dMajor(event.target.value)}
          />
          <span className="text-xs text-slate-500">Preview: {preview7d}</span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-800">30-day price</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={price30dMajor}
            onChange={(event) => setPrice30dMajor(event.target.value)}
          />
          <span className="text-xs text-slate-500">Preview: {preview30d}</span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-800">Review SLA (days)</span>
          <input
            type="number"
            min={1}
            max={30}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={draft.reviewSlaDays}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, reviewSlaDays: Number(event.target.value || 1) }))
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-800">Minimum photos</span>
          <input
            type="number"
            min={0}
            max={20}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={draft.minPhotos}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, minPhotos: Number(event.target.value || 0) }))
            }
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-800">Minimum description length (characters)</span>
          <input
            type="number"
            min={0}
            max={5000}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={draft.minDescriptionChars}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                minDescriptionChars: Number(event.target.value || 0),
              }))
            }
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            checked={draft.requiresApprovedListing}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, requiresApprovedListing: event.target.checked }))
            }
          />
          Require approved listing
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            checked={draft.requiresActiveListing}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, requiresActiveListing: event.target.checked }))
            }
          />
          Require active listing
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            checked={draft.requiresNotDemo}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, requiresNotDemo: event.target.checked }))
            }
          />
          Require non-demo listing
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save featured request settings"}
        </Button>
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
        {toast ? <span className="text-xs text-emerald-600">{toast}</span> : null}
      </div>
    </div>
  );
}
