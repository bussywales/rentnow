"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  getTenantNotificationSettings,
  normalizeNotificationTimezone,
  updateTenantNotificationSettings,
  type TenantNotificationSettingsPayload,
} from "@/lib/notifications/settings";

const TIMEZONE_OPTIONS = [
  { value: "Europe/London", label: "Europe/London (UK)" },
  { value: "Africa/Lagos", label: "Africa/Lagos (NG)" },
  { value: "America/New_York", label: "America/New_York (US)" },
  { value: "America/Toronto", label: "America/Toronto (CA)" },
] as const;

const DEFAULT_SETTINGS: TenantNotificationSettingsPayload = {
  savedSearchPushEnabled: true,
  savedSearchPushMode: "instant",
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: "Europe/London",
};

export function validateQuietHoursForSave(input: {
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}) {
  if (!input.quietHoursEnabled) return null;
  if (!input.quietHoursStart || !input.quietHoursEnd) {
    return "Choose a start and end time. Overnight ranges (e.g., 22:00–07:00) are supported.";
  }
  if (input.quietHoursStart === input.quietHoursEnd) {
    return "Start and end times must be different.";
  }
  return null;
}

export function NotificationSettingsCard() {
  const [settings, setSettings] = useState<TenantNotificationSettingsPayload>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const result = await getTenantNotificationSettings();
      if (cancelled) return;

      if (!result.ok || !result.settings) {
        setError(result.error);
        setSettings(DEFAULT_SETTINGS);
        setQuietHoursEnabled(false);
      } else {
        setError(null);
        setSettings(result.settings);
        setQuietHoursEnabled(
          Boolean(result.settings.quietHoursStart && result.settings.quietHoursEnd)
        );
      }

      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveSettings = useMemo<TenantNotificationSettingsPayload>(() => {
    if (quietHoursEnabled) return settings;
    return {
      ...settings,
      quietHoursStart: null,
      quietHoursEnd: null,
    };
  }, [quietHoursEnabled, settings]);

  const updateField = <K extends keyof TenantNotificationSettingsPayload>(
    key: K,
    value: TenantNotificationSettingsPayload[K]
  ) => {
    setError(null);
    setSuccess(null);
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    const payload: TenantNotificationSettingsPayload = {
      ...effectiveSettings,
      timezone: normalizeNotificationTimezone(effectiveSettings.timezone),
    };

    const quietHoursError = validateQuietHoursForSave({
      quietHoursEnabled,
      quietHoursStart: payload.quietHoursStart,
      quietHoursEnd: payload.quietHoursEnd,
    });
    if (quietHoursError) {
      setError(quietHoursError);
      return;
    }

    setSaving(true);

    const result = await updateTenantNotificationSettings(payload);

    setSaving(false);
    if (!result.ok || !result.settings) {
      setError(result.error);
      return;
    }

    setSettings(result.settings);
    setQuietHoursEnabled(
      Boolean(result.settings.quietHoursStart && result.settings.quietHoursEnd)
    );
    setSuccess("Notification settings saved.");
  };

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="tenant-notification-settings-card"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-900">Notification settings</h2>
        <p className="text-xs text-slate-600">
          Alerts are based on your saved searches. You can pause anytime.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <span className="font-medium text-slate-800">Saved-search alerts</span>
          <input
            type="checkbox"
            checked={settings.savedSearchPushEnabled}
            onChange={(event) =>
              updateField("savedSearchPushEnabled", event.target.checked)
            }
            aria-label="Toggle saved-search alerts"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Frequency
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800"
            value={settings.savedSearchPushMode}
            onChange={(event) =>
              updateField(
                "savedSearchPushMode",
                event.target.value as TenantNotificationSettingsPayload["savedSearchPushMode"]
              )
            }
            disabled={!settings.savedSearchPushEnabled}
            data-testid="tenant-notification-frequency"
          >
            <option value="instant">Instant</option>
            <option value="daily">Daily digest</option>
          </select>
        </label>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <span className="font-medium text-slate-800">Quiet hours</span>
          <input
            type="checkbox"
            checked={quietHoursEnabled}
            onChange={(event) => {
              const nextEnabled = event.target.checked;
              setQuietHoursEnabled(nextEnabled);
              setError(null);
              setSuccess(null);
              if (!nextEnabled) {
                setSettings((prev) => ({
                  ...prev,
                  quietHoursStart: null,
                  quietHoursEnd: null,
                }));
              }
            }}
            aria-label="Toggle quiet hours"
            disabled={!settings.savedSearchPushEnabled}
          />
        </label>

        {quietHoursEnabled && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Start
              <input
                type="time"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800"
                value={settings.quietHoursStart ?? "22:00"}
                onChange={(event) => updateField("quietHoursStart", event.target.value)}
                data-testid="tenant-notification-quiet-start"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              End
              <input
                type="time"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800"
                value={settings.quietHoursEnd ?? "07:00"}
                onChange={(event) => updateField("quietHoursEnd", event.target.value)}
                data-testid="tenant-notification-quiet-end"
              />
            </label>
          </div>
        )}

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Timezone
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800"
            value={settings.timezone}
            onChange={(event) => updateField("timezone", event.target.value)}
            data-testid="tenant-notification-timezone"
          >
            {TIMEZONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => void handleSave()}
          disabled={loading || saving}
          data-testid="tenant-notification-save"
        >
          {saving ? "Saving..." : "Save settings"}
        </Button>
        {loading && <span className="text-xs text-slate-500">Loading settings...</span>}
      </div>

      {success && <p className="mt-2 text-xs text-emerald-700">{success}</p>}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      <p className="mt-2 text-[11px] text-slate-500">
        Daily digest sends at most one push per day when new matches appear.
      </p>
    </section>
  );
}
