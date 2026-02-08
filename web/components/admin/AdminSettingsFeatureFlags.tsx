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

const DESCRIPTIONS: Partial<Record<AppSettingKey, { title: string; helper: string }>> =
  {
  [APP_SETTING_KEYS.showTenantPhotoTrustSignals]: {
    title: "Tenant photo details",
    helper: "Shows non-sensitive photo metadata (no GPS) on property pages for tenants.",
  },
  [APP_SETTING_KEYS.enableLocationPicker]: {
    title: "Location picker",
    helper: "Enable address search and map pin to capture approximate listing locations.",
  },
  [APP_SETTING_KEYS.showTenantCheckinBadge]: {
    title: "Tenant check-in badge",
    helper:
      "Show a small ‘checked in recently’ indicator to tenants. No GPS coordinates are shown.",
  },
  [APP_SETTING_KEYS.requireLocationPinForPublish]: {
    title: "Location required to publish",
    helper:
      "When enabled, hosts must pin a general location before publishing. Drafts are still allowed.",
  },
  [APP_SETTING_KEYS.agentStorefrontsEnabled]: {
    title: "Agent storefronts (public pages)",
    helper: "Disable to hide all agent storefront pages immediately.",
  },
  [APP_SETTING_KEYS.agentNetworkDiscoveryEnabled]: {
    title: "Agent Network Discovery",
    helper:
      "Allow agents to browse other agents’ live listings and add them to client pages (attribution-only).",
  },
};

export default function AdminSettingsFeatureFlags({ settings }: Props) {
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState<Record<AppSettingKey, SettingRow>>(
    () => Object.fromEntries(settings.map((s) => [s.key, s])) as Record<AppSettingKey, SettingRow>
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
      const isBadge = settingKey === "show_tenant_checkin_badge";
      if (isBadge) {
        setToast(next ? "Tenant check-in badge enabled." : "Tenant check-in badge disabled.");
      } else {
        setToast("Updated.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {Object.values(local).map((setting) => {
        const copy = DESCRIPTIONS[setting.key] ?? {
          title: setting.key,
          helper: "",
        };
        return (
          <div
            key={setting.key}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            data-testid={`admin-setting-${setting.key}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{copy.title}</h2>
                <p className="text-sm text-slate-600">{copy.helper}</p>
                {setting.updatedAt && (
                  <p className="text-xs text-slate-500">
                    Last updated {new Date(setting.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">
                  {setting.enabled ? "Enabled" : "Disabled"}
                </span>
                <Button
                  size="sm"
                  variant={setting.enabled ? "secondary" : "primary"}
                  disabled={pending}
                  onClick={() => toggle(setting.key, !setting.enabled)}
                >
                  {pending ? "Saving..." : setting.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {toast && <p className="text-xs text-emerald-600">{toast}</p>}
    </div>
  );
}
