export const CONTACT_EXCHANGE_MODES = ["off", "redact", "block"] as const;
export type ContactExchangeMode = (typeof CONTACT_EXCHANGE_MODES)[number];

export type AlertsLastRunStatus = {
  ran_at_utc: string | null;
  mode: "cron" | "admin";
  users_processed: number;
  digests_sent: number;
  searches_included: number;
  failed_users: number;
  disabled_reason: null | "kill_switch" | "feature_flag_off";
};

export const DEFAULT_ALERTS_LAST_RUN_STATUS: AlertsLastRunStatus = {
  ran_at_utc: null,
  mode: "admin",
  users_processed: 0,
  digests_sent: 0,
  searches_included: 0,
  failed_users: 0,
  disabled_reason: null,
};

export function parseAppSettingBool(value: unknown, defaultValue: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "object" && value !== null && "enabled" in value) {
    const enabled = (value as { enabled?: unknown }).enabled;
    if (typeof enabled === "boolean") return enabled;
  }
  return defaultValue;
}

export function parseAppSettingInt(value: unknown, defaultValue: number) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const num = Number(value);
    if (Number.isFinite(num)) return Math.trunc(num);
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const candidates = [record.days, record.value];
    for (const candidate of candidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate)) return Math.trunc(candidate);
      if (typeof candidate === "string" && candidate.trim() !== "") {
        const num = Number(candidate);
        if (Number.isFinite(num)) return Math.trunc(num);
      }
    }
  }
  return defaultValue;
}

export function parseContactExchangeMode(
  value: unknown,
  defaultValue: ContactExchangeMode
): ContactExchangeMode {
  if (typeof value === "string" && CONTACT_EXCHANGE_MODES.includes(value as ContactExchangeMode)) {
    return value as ContactExchangeMode;
  }
  if (typeof value === "object" && value !== null && "mode" in value) {
    const mode = (value as { mode?: unknown }).mode;
    if (typeof mode === "string" && CONTACT_EXCHANGE_MODES.includes(mode as ContactExchangeMode)) {
      return mode as ContactExchangeMode;
    }
  }
  return defaultValue;
}

export function parseAppSettingString(value: unknown, defaultValue: string) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const candidates = [record.value, record.code, record.jurisdiction];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }
  return defaultValue;
}

function parseNonNegativeInt(input: unknown, fallback: number): number {
  if (typeof input === "number" && Number.isFinite(input)) return Math.max(0, Math.trunc(input));
  if (typeof input === "string" && input.trim() !== "") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
  }
  return fallback;
}

function parseIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function parseAlertsLastRunStatus(value: unknown): AlertsLastRunStatus {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_ALERTS_LAST_RUN_STATUS;
  }
  const record = value as Record<string, unknown>;
  const mode = record.mode === "cron" ? "cron" : "admin";
  const disabledReason =
    record.disabled_reason === "kill_switch" || record.disabled_reason === "feature_flag_off"
      ? record.disabled_reason
      : null;
  return {
    ran_at_utc: parseIsoTimestamp(record.ran_at_utc),
    mode,
    users_processed: parseNonNegativeInt(record.users_processed, 0),
    digests_sent: parseNonNegativeInt(record.digests_sent, 0),
    searches_included: parseNonNegativeInt(record.searches_included, 0),
    failed_users: parseNonNegativeInt(record.failed_users, 0),
    disabled_reason: disabledReason,
  };
}
