"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { APP_SETTING_KEYS, type AppSettingKey } from "@/lib/settings/app-settings-keys";

type SettingRow = {
  key: AppSettingKey;
  enabled: boolean;
  updatedAt: string | null;
};

type Props = {
  settings: SettingRow[];
};

const GATE_ORDER = [
  APP_SETTING_KEYS.canadaRentalPaygRuntimeEnabled,
  APP_SETTING_KEYS.canadaRentalPaygCheckoutSessionCreationEnabled,
  APP_SETTING_KEYS.canadaRentalPaygWebhookFulfilmentEnabled,
  APP_SETTING_KEYS.canadaRentalPaygPaymentPersistenceEnabled,
  APP_SETTING_KEYS.canadaRentalPaygEntitlementGrantEnabled,
  APP_SETTING_KEYS.canadaRentalPaygListingUnlockEnabled,
  APP_SETTING_KEYS.canadaRentalPaygEntitlementConsumeEnabled,
] as const;

const GATE_COPY: Record<
  (typeof GATE_ORDER)[number],
  { title: string; helper: string; recommendedEnabled: boolean }
> = {
  [APP_SETTING_KEYS.canadaRentalPaygRuntimeEnabled]: {
    title: "Runtime gate",
    helper: "Master Canada PAYG runtime switch for the guarded CA listing_submission path.",
    recommendedEnabled: true,
  },
  [APP_SETTING_KEYS.canadaRentalPaygCheckoutSessionCreationEnabled]: {
    title: "Checkout session creation",
    helper: "Allows Stripe Checkout Session creation for valid CA rental listing_submission requests.",
    recommendedEnabled: true,
  },
  [APP_SETTING_KEYS.canadaRentalPaygWebhookFulfilmentEnabled]: {
    title: "Webhook fulfilment",
    helper: "Allows the guarded Canada checkout.session.completed fulfilment branch to run.",
    recommendedEnabled: true,
  },
  [APP_SETTING_KEYS.canadaRentalPaygPaymentPersistenceEnabled]: {
    title: "Payment persistence",
    helper: "Allows listing_payments writes for Canada Stripe one-off PAYG webhook fulfilment.",
    recommendedEnabled: true,
  },
  [APP_SETTING_KEYS.canadaRentalPaygEntitlementGrantEnabled]: {
    title: "Entitlement grant",
    helper: "Allows canada_listing_payg_entitlements writes after successful Canada Stripe payment fulfilment.",
    recommendedEnabled: true,
  },
  [APP_SETTING_KEYS.canadaRentalPaygListingUnlockEnabled]: {
    title: "Listing unlock",
    helper: "Future listing-only cap bypass and submit unlock gate. Keep off during test-mode mutation validation.",
    recommendedEnabled: false,
  },
  [APP_SETTING_KEYS.canadaRentalPaygEntitlementConsumeEnabled]: {
    title: "Entitlement consume",
    helper: "Future one-time entitlement consumption gate. Keep off until submit unlock is proven end-to-end.",
    recommendedEnabled: false,
  },
};

export default function AdminSettingsCanadaPaygGates({ settings }: Props) {
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState<Record<AppSettingKey, SettingRow>>(
    () => Object.fromEntries(settings.map((setting) => [setting.key, setting])) as Record<
      AppSettingKey,
      SettingRow
    >
  );
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const toggle = (settingKey: AppSettingKey, next: boolean) => {
    setError(null);
    startTransition(async () => {
      setToast(null);
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: settingKey,
          value: { enabled: next },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not update setting");
        return;
      }
      setLocal((prev) => ({
        ...prev,
        [settingKey]: {
          key: settingKey,
          enabled: next,
          updatedAt: data?.setting?.updated_at ?? new Date().toISOString(),
        },
      }));
      setToast("Updated.");
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-amber-950">Canada PAYG test-mode gates</h2>
        <div className="mt-2 space-y-2 text-sm text-amber-900">
          <p>These gates are for controlled Stripe test-mode validation only.</p>
          <p>
            Do not enable listing unlock or entitlement consume until payment and entitlement grant
            have been proven.
          </p>
          <p>
            Production activation still requires tax, receipt, compliance, and operator sign-off.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Recommended safe state for current test
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {GATE_ORDER.map((key) => (
            <li key={key} className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-slate-600">{key}</span>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  GATE_COPY[key].recommendedEnabled
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {GATE_COPY[key].recommendedEnabled ? "Recommended ON" : "Recommended OFF"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {GATE_ORDER.map((key) => {
        const setting = local[key];
        const copy = GATE_COPY[key];
        return (
          <div
            key={key}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            data-testid={`admin-setting-${key}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-slate-900">{copy.title}</h3>
                <p className="text-sm text-slate-600">{copy.helper}</p>
                <p className="font-mono text-xs text-slate-500">{key}</p>
                {setting.updatedAt ? (
                  <p className="text-xs text-slate-500">
                    Last updated {new Date(setting.updatedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">
                  {setting.enabled ? "Enabled" : "Disabled"}
                </span>
                <Button
                  size="sm"
                  variant={setting.enabled ? "secondary" : "primary"}
                  disabled={pending}
                  onClick={() => toggle(key, !setting.enabled)}
                >
                  {pending ? "Saving..." : setting.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {toast ? <p className="text-xs text-emerald-600">{toast}</p> : null}
    </div>
  );
}
