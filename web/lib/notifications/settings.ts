export type SavedSearchPushMode = "instant" | "daily";

export type TenantNotificationPrefsRow = {
  profile_id: string;
  saved_search_push_enabled?: boolean | null;
  saved_search_push_mode?: string | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  timezone?: string | null;
  last_saved_search_push_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TenantNotificationPrefs = {
  profileId: string;
  savedSearchPushEnabled: boolean;
  savedSearchPushMode: SavedSearchPushMode;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  lastSavedSearchPushAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SavedSearchPushPolicyReason =
  | "prefs_disabled"
  | "quiet_hours"
  | "daily_cap";

export const DEFAULT_TENANT_NOTIFICATION_TIMEZONE = "Europe/London";

const TIME_VALUE_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toIsoOrNull(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function normalizeTimeValue(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const padded = /^\d{1}:\d{2}$/.test(trimmed) ? `0${trimmed}` : trimmed;
  return TIME_VALUE_REGEX.test(padded) ? padded : null;
}

function parseMinutes(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(TIME_VALUE_REGEX);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getLocalHourMinute(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  let hour = 0;
  let minute = 0;

  for (const part of formatter.formatToParts(now)) {
    if (part.type === "hour") hour = Number(part.value);
    if (part.type === "minute") minute = Number(part.value);
  }

  return hour * 60 + minute;
}

function getLocalDayKey(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  let year = "0000";
  let month = "00";
  let day = "00";

  for (const part of formatter.formatToParts(now)) {
    if (part.type === "year") year = part.value;
    if (part.type === "month") month = part.value;
    if (part.type === "day") day = part.value;
  }

  return `${year}-${month}-${day}`;
}

export function normalizeNotificationTimezone(value: string | null | undefined) {
  const candidate = (value ?? "").trim();
  if (!candidate) return DEFAULT_TENANT_NOTIFICATION_TIMEZONE;

  try {
    // Throws RangeError for invalid IANA timezone names.
    new Intl.DateTimeFormat("en-GB", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TENANT_NOTIFICATION_TIMEZONE;
  }
}

export function resolveDefaultNotificationTimezone(countryCode?: string | null) {
  const normalized = (countryCode ?? "").trim().toUpperCase();
  if (normalized === "NG") return "Africa/Lagos";
  if (normalized === "GB" || normalized === "UK") return "Europe/London";
  if (normalized === "CA") return "America/Toronto";
  if (normalized === "US") return "America/New_York";
  return DEFAULT_TENANT_NOTIFICATION_TIMEZONE;
}

export function buildDefaultTenantNotificationPrefs(input: {
  profileId: string;
  countryCode?: string | null;
}): TenantNotificationPrefs {
  return {
    profileId: input.profileId,
    savedSearchPushEnabled: true,
    savedSearchPushMode: "instant",
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: resolveDefaultNotificationTimezone(input.countryCode),
    lastSavedSearchPushAt: null,
    createdAt: null,
    updatedAt: null,
  };
}

export function normalizeSavedSearchPushMode(value: string | null | undefined): SavedSearchPushMode {
  if (value === "daily") return "daily";
  return "instant";
}

export function normalizeTenantNotificationPrefs(input: {
  profileId: string;
  countryCode?: string | null;
  row?: TenantNotificationPrefsRow | null;
}): TenantNotificationPrefs {
  const defaults = buildDefaultTenantNotificationPrefs({
    profileId: input.profileId,
    countryCode: input.countryCode,
  });

  if (!input.row) {
    return defaults;
  }

  const quietStart = normalizeTimeValue(input.row.quiet_hours_start ?? null);
  const quietEnd = normalizeTimeValue(input.row.quiet_hours_end ?? null);
  const quietHoursStart = quietStart && quietEnd ? quietStart : null;
  const quietHoursEnd = quietStart && quietEnd ? quietEnd : null;

  return {
    profileId: input.row.profile_id ?? defaults.profileId,
    savedSearchPushEnabled:
      typeof input.row.saved_search_push_enabled === "boolean"
        ? input.row.saved_search_push_enabled
        : defaults.savedSearchPushEnabled,
    savedSearchPushMode: normalizeSavedSearchPushMode(input.row.saved_search_push_mode),
    quietHoursStart,
    quietHoursEnd,
    timezone: normalizeNotificationTimezone(input.row.timezone ?? defaults.timezone),
    lastSavedSearchPushAt: toIsoOrNull(input.row.last_saved_search_push_at ?? null),
    createdAt: toIsoOrNull(input.row.created_at ?? null),
    updatedAt: toIsoOrNull(input.row.updated_at ?? null),
  };
}

export function isWithinQuietHours(input: {
  now: Date;
  timezone: string;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}) {
  const start = parseMinutes(normalizeTimeValue(input.quietHoursStart ?? null));
  const end = parseMinutes(normalizeTimeValue(input.quietHoursEnd ?? null));

  if (start === null || end === null) return false;
  if (start === end) return false;

  const current = getLocalHourMinute(input.now, normalizeNotificationTimezone(input.timezone));

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}

export function isDailyPushCapReached(input: {
  now: Date;
  timezone: string;
  lastSavedSearchPushAt?: string | null;
}) {
  const lastSentIso = toIsoOrNull(input.lastSavedSearchPushAt ?? null);
  if (!lastSentIso) return false;

  const timezone = normalizeNotificationTimezone(input.timezone);
  const currentDay = getLocalDayKey(input.now, timezone);
  const lastSentDay = getLocalDayKey(new Date(lastSentIso), timezone);

  return currentDay === lastSentDay;
}

export function evaluateSavedSearchPushPolicy(input: {
  prefs: TenantNotificationPrefs;
  now: Date;
}): { allow: true } | { allow: false; reason: SavedSearchPushPolicyReason } {
  if (!input.prefs.savedSearchPushEnabled) {
    return { allow: false, reason: "prefs_disabled" };
  }

  if (
    isWithinQuietHours({
      now: input.now,
      timezone: input.prefs.timezone,
      quietHoursStart: input.prefs.quietHoursStart,
      quietHoursEnd: input.prefs.quietHoursEnd,
    })
  ) {
    return { allow: false, reason: "quiet_hours" };
  }

  if (
    input.prefs.savedSearchPushMode === "daily" &&
    isDailyPushCapReached({
      now: input.now,
      timezone: input.prefs.timezone,
      lastSavedSearchPushAt: input.prefs.lastSavedSearchPushAt,
    })
  ) {
    return { allow: false, reason: "daily_cap" };
  }

  return { allow: true };
}

export function normalizeQuietHoursInput(input: {
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}) {
  const start = normalizeTimeValue(input.quietHoursStart ?? null);
  const end = normalizeTimeValue(input.quietHoursEnd ?? null);
  if (!start || !end) {
    return { quietHoursStart: null, quietHoursEnd: null };
  }
  return { quietHoursStart: start, quietHoursEnd: end };
}

export type TenantNotificationSettingsPayload = {
  savedSearchPushEnabled: boolean;
  savedSearchPushMode: SavedSearchPushMode;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
};

export function toTenantNotificationSettingsPayload(
  prefs: TenantNotificationPrefs
): TenantNotificationSettingsPayload {
  return {
    savedSearchPushEnabled: prefs.savedSearchPushEnabled,
    savedSearchPushMode: prefs.savedSearchPushMode,
    quietHoursStart: prefs.quietHoursStart,
    quietHoursEnd: prefs.quietHoursEnd,
    timezone: prefs.timezone,
  };
}

export async function getTenantNotificationSettings() {
  const response = await fetch("/api/tenant/notifications/settings", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        error?: string;
        settings?: TenantNotificationSettingsPayload;
      }
    | null;

  if (!response.ok || !payload?.settings) {
    return {
      ok: false as const,
      error: payload?.error || "Unable to load notification settings.",
      settings: null,
    };
  }

  return {
    ok: true as const,
    error: null,
    settings: payload.settings,
  };
}

export async function updateTenantNotificationSettings(
  settings: TenantNotificationSettingsPayload
) {
  const response = await fetch("/api/tenant/notifications/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(settings),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        error?: string;
        settings?: TenantNotificationSettingsPayload;
      }
    | null;

  if (!response.ok || !payload?.settings) {
    return {
      ok: false as const,
      error: payload?.error || "Unable to save notification settings.",
      settings: null,
    };
  }

  return {
    ok: true as const,
    error: null,
    settings: payload.settings,
  };
}
