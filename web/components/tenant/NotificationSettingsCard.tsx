"use client";

import { useEffect, useMemo, useState } from "react";
import { PwaInstallCta } from "@/components/pwa/PwaInstallCta";
import { Button } from "@/components/ui/Button";
import {
  getTenantNotificationSettings,
  normalizeNotificationTimezone,
  updateTenantNotificationSettings,
  type TenantNotificationSettingsPayload,
} from "@/lib/notifications/settings";
import {
  getPwaInstallIntentFlag,
  setPwaInstallIntentFlag,
} from "@/lib/pwa/install";

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

const DEFAULT_QUIET_HOURS_START = "22:00";
const DEFAULT_QUIET_HOURS_END = "07:00";
const QUIET_TIME_INPUT_REGEX = /^(\d{1,2})\s*:\s*([0-5]\d)$/;

export function normalizeQuietTimeForSave(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(QUIET_TIME_INPUT_REGEX);
  if (!match) return null;

  const hour = Number(match[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;

  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

export function validateQuietHoursForSave(input: {
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}) {
  if (!input.quietHoursEnabled) return null;
  const start = normalizeQuietTimeForSave(input.quietHoursStart);
  const end = normalizeQuietTimeForSave(input.quietHoursEnd);
  if (!start || !end) {
    return "Choose a start and end time. Overnight ranges (e.g., 22:00–07:00) are supported.";
  }
  if (start === end) {
    return "Start and end times must be different.";
  }
  return null;
}

export function deriveNotificationSettingsUiState(input: {
  loading: boolean;
  saving: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursInteracted: boolean;
  attemptedSave: boolean;
}) {
  const quietHoursError = validateQuietHoursForSave({
    quietHoursEnabled: input.quietHoursEnabled,
    quietHoursStart: input.quietHoursStart,
    quietHoursEnd: input.quietHoursEnd,
  });

  const showQuietHoursError = Boolean(
    quietHoursError && (input.attemptedSave || input.quietHoursInteracted)
  );

  return {
    quietHoursError,
    showQuietHoursError,
    disableSave: input.loading || input.saving || Boolean(quietHoursError),
  };
}

export function NotificationSettingsCard() {
  const [settings, setSettings] = useState<TenantNotificationSettingsPayload>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursInteracted, setQuietHoursInteracted] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [installIntentTriggered, setInstallIntentTriggered] = useState(() => {
    if (typeof window === "undefined") return false;
    return getPwaInstallIntentFlag(window.localStorage);
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const result = await getTenantNotificationSettings();
      if (cancelled) return;

      if (!result.ok || !result.settings) {
        setApiError(result.error);
        setSettings(DEFAULT_SETTINGS);
        setQuietHoursEnabled(false);
        setQuietHoursInteracted(false);
        setAttemptedSave(false);
      } else {
        setApiError(null);
        setSettings(result.settings);
        setQuietHoursEnabled(
          Boolean(result.settings.quietHoursStart && result.settings.quietHoursEnd)
        );
        setQuietHoursInteracted(false);
        setAttemptedSave(false);
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
    setApiError(null);
    setSuccess(null);
    setAttemptedSave(false);
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const uiState = deriveNotificationSettingsUiState({
    loading,
    saving,
    quietHoursEnabled,
    quietHoursStart: quietHoursEnabled
      ? normalizeQuietTimeForSave(effectiveSettings.quietHoursStart)
      : null,
    quietHoursEnd: quietHoursEnabled
      ? normalizeQuietTimeForSave(effectiveSettings.quietHoursEnd)
      : null,
    quietHoursInteracted,
    attemptedSave,
  });

  const handleSave = async () => {
    setApiError(null);
    setSuccess(null);
    setAttemptedSave(true);

    if (uiState.quietHoursError) {
      return;
    }

    const payload: TenantNotificationSettingsPayload = {
      ...effectiveSettings,
      quietHoursStart: quietHoursEnabled
        ? normalizeQuietTimeForSave(effectiveSettings.quietHoursStart)
        : null,
      quietHoursEnd: quietHoursEnabled
        ? normalizeQuietTimeForSave(effectiveSettings.quietHoursEnd)
        : null,
      timezone: normalizeNotificationTimezone(effectiveSettings.timezone),
    };

    setSaving(true);

    const result = await updateTenantNotificationSettings(payload);

    setSaving(false);
    if (!result.ok || !result.settings) {
      setApiError(result.error);
      return;
    }

    setSettings(result.settings);
    setQuietHoursEnabled(
      Boolean(result.settings.quietHoursStart && result.settings.quietHoursEnd)
    );
    setQuietHoursInteracted(false);
    setAttemptedSave(false);
    setSuccess("Notification settings saved.");
    setInstallIntentTriggered(true);
    setPwaInstallIntentFlag(true);
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
              setApiError(null);
              setSuccess(null);
              setAttemptedSave(false);
              setQuietHoursInteracted(false);
              setSettings((prev) =>
                nextEnabled
                  ? {
                      ...prev,
                      quietHoursStart:
                        normalizeQuietTimeForSave(prev.quietHoursStart) ??
                        DEFAULT_QUIET_HOURS_START,
                      quietHoursEnd:
                        normalizeQuietTimeForSave(prev.quietHoursEnd) ??
                        DEFAULT_QUIET_HOURS_END,
                    }
                  : {
                      ...prev,
                      quietHoursStart: null,
                      quietHoursEnd: null,
                    }
              );
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
                value={settings.quietHoursStart ?? DEFAULT_QUIET_HOURS_START}
                onChange={(event) =>
                  updateField("quietHoursStart", normalizeQuietTimeForSave(event.target.value))
                }
                onBlur={() => setQuietHoursInteracted(true)}
                data-testid="tenant-notification-quiet-start"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              End
              <input
                type="time"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800"
                value={settings.quietHoursEnd ?? DEFAULT_QUIET_HOURS_END}
                onChange={(event) =>
                  updateField("quietHoursEnd", normalizeQuietTimeForSave(event.target.value))
                }
                onBlur={() => setQuietHoursInteracted(true)}
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
          disabled={uiState.disableSave}
          data-testid="tenant-notification-save"
        >
          {saving ? "Saving..." : "Save settings"}
        </Button>
        {loading && <span className="text-xs text-slate-500">Loading settings...</span>}
      </div>

      {success && <p className="mt-2 text-xs text-emerald-700">{success}</p>}
      {apiError && <p className="mt-2 text-xs text-rose-600">{apiError}</p>}
      {uiState.showQuietHoursError && (
        <p className="mt-2 text-xs text-rose-600" data-testid="tenant-notification-quiet-error">
          {uiState.quietHoursError}
        </p>
      )}
      {quietHoursEnabled && !uiState.showQuietHoursError && (
        <p className="mt-2 text-xs text-slate-500" data-testid="tenant-notification-quiet-helper">
          Overnight ranges (e.g., 22:00–07:00) are supported.
        </p>
      )}

      <p className="mt-2 text-[11px] text-slate-500">
        Daily digest sends at most one push per day when new matches appear.
      </p>
      <PwaInstallCta intentTriggered={installIntentTriggered} className="mt-3" />
    </section>
  );
}
