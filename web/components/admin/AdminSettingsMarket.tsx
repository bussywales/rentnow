"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { DEFAULT_MARKET_SETTINGS, formatCurrencySymbol } from "@/lib/market/market";

type MarketSettingsState = {
  defaultCountry: string;
  defaultCurrency: string;
  autoDetectEnabled: boolean;
  selectorEnabled: boolean;
};

type Props = {
  settings: MarketSettingsState;
  updatedAt: {
    defaultCountry: string | null;
    defaultCurrency: string | null;
    autoDetectEnabled: string | null;
    selectorEnabled: string | null;
  };
};

const COUNTRY_OPTIONS = [
  { code: "NG", label: "Nigeria" },
  { code: "GB", label: "United Kingdom" },
] as const;

const CURRENCY_OPTIONS = ["NGN", "GBP", "USD", "EUR"] as const;

export default function AdminSettingsMarket({ settings, updatedAt }: Props) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<MarketSettingsState>(settings);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const countryOptions = useMemo(() => {
    const unique = new Set([draft.defaultCountry.toUpperCase(), ...COUNTRY_OPTIONS.map((entry) => entry.code)]);
    return Array.from(unique);
  }, [draft.defaultCountry]);

  const currencyOptions = useMemo(() => {
    const unique = new Set([draft.defaultCurrency.toUpperCase(), ...CURRENCY_OPTIONS]);
    return Array.from(unique);
  }, [draft.defaultCurrency]);

  const save = () => {
    setError(null);
    setToast(null);
    const country = draft.defaultCountry.trim().toUpperCase();
    const currency = draft.defaultCurrency.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      setError("Default market country must be a valid ISO alpha-2 code (for example NG).");
      return;
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      setError("Default market currency must be a valid ISO currency code (for example NGN).");
      return;
    }

    startTransition(async () => {
      try {
        const payloads = [
          { key: APP_SETTING_KEYS.defaultMarketCountry, value: { value: country } },
          { key: APP_SETTING_KEYS.defaultMarketCurrency, value: { value: currency } },
          {
            key: APP_SETTING_KEYS.marketAutoDetectEnabled,
            value: { enabled: draft.autoDetectEnabled },
          },
          {
            key: APP_SETTING_KEYS.marketSelectorEnabled,
            value: { enabled: draft.selectorEnabled },
          },
        ];
        const results = await Promise.all(
          payloads.map((body) =>
            fetch("/api/admin/app-settings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
          )
        );
        for (const response of results) {
          if (response.ok) continue;
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || "Unable to update market settings.");
        }
        setDraft((prev) => ({
          ...prev,
          defaultCountry: country,
          defaultCurrency: currency,
        }));
        setToast("Market settings saved.");
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Unable to update market settings."
        );
      }
    });
  };

  const previewLabel = `${draft.defaultCountry.toUpperCase()} (${formatCurrencySymbol(
    draft.defaultCurrency
  )})`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Market defaults</h2>
        <p className="text-sm text-slate-600">
          Launch default market for visitors without a selection.
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Default country</span>
          <select
            value={draft.defaultCountry.toUpperCase()}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, defaultCountry: event.target.value.toUpperCase() }))
            }
            className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {countryOptions.map((code) => {
              const option = COUNTRY_OPTIONS.find((entry) => entry.code === code);
              const label = option ? `${option.label} (${code})` : code;
              return (
                <option key={code} value={code}>
                  {label}
                </option>
              );
            })}
          </select>
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Default currency</span>
          <select
            value={draft.defaultCurrency.toUpperCase()}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, defaultCurrency: event.target.value.toUpperCase() }))
            }
            className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {currencyOptions.map((code) => (
              <option key={code} value={code}>
                {code} ({formatCurrencySymbol(code)})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.autoDetectEnabled}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, autoDetectEnabled: event.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Auto-detect market from visitor location headers</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.selectorEnabled}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, selectorEnabled: event.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Show market selector in header</span>
        </label>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Current preview: <span className="font-semibold">{previewLabel}</span>
      </p>
      <p className="text-xs text-slate-500">
        Last updated:{" "}
        {updatedAt.defaultCountry ||
        updatedAt.defaultCurrency ||
        updatedAt.autoDetectEnabled ||
        updatedAt.selectorEnabled
          ? new Date(
              updatedAt.defaultCountry ||
                updatedAt.defaultCurrency ||
                updatedAt.autoDetectEnabled ||
                updatedAt.selectorEnabled ||
                new Date().toISOString()
            ).toLocaleString()
          : "Never"}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Defaults: {DEFAULT_MARKET_SETTINGS.defaultCountry}/{DEFAULT_MARKET_SETTINGS.defaultCurrency}.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save market settings"}
        </Button>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        {toast ? <p className="text-xs text-emerald-600">{toast}</p> : null}
      </div>
    </section>
  );
}

