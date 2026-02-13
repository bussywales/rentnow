import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { filtersToSearchParams, parseFiltersFromSavedSearch } from "@/lib/search-filters";
import { getSiteUrl } from "@/lib/env";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { parseAppSettingBool } from "@/lib/settings/app-settings";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import {
  buildSavedSearchDigestEmail,
  type SavedSearchDigestGroup,
} from "@/lib/email/templates/saved-search-digest";
import {
  applySavedSearchMatchSpecToQuery,
  buildSavedSearchMatchQuerySpec,
} from "@/lib/saved-searches/matching";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const INSTANT_RATE_LIMIT_MS = 6 * 60 * 60 * 1000;
const DAILY_RATE_LIMIT_MS = 24 * 60 * 60 * 1000;
const WEEKLY_RATE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 200;
const MAX_SEARCHES_PER_DIGEST = 10;
const ALERTS_EMAIL_ENABLED_ENV = "ALERTS_EMAIL_ENABLED";

export type SavedSearchAlertFrequency = "instant" | "daily" | "weekly";

export type SavedSearchAlertSearchRow = {
  id: string;
  user_id: string;
  name: string;
  query_params: Record<string, unknown> | null;
  is_active?: boolean | null;
  alerts_enabled?: boolean | null;
  alert_frequency?: string | null;
  created_at?: string | null;
  alert_last_sent_at?: string | null;
  alert_baseline_at?: string | null;
};

export type SavedSearchAlertListingRow = {
  id: string;
  title: string;
  city: string | null;
  price: number | null;
  currency: string | null;
  cover_image_url?: string | null;
  created_at?: string | null;
};

export type SavedSearchAlertsRunResult = {
  ok: boolean;
  processed: number;
  processedUsers: number;
  sent: number;
  emailsSent: number;
  failed: number;
  failedUsers: number;
  skipped: number;
  duplicates: number;
  noMatches: number;
  disabledReason?: "kill_switch" | "feature_flag_off" | null;
};

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

type SavedSearchAlertDeps = {
  getNow: () => Date;
  getSiteUrl: typeof getSiteUrl;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  sendEmail: (input: SendEmailInput) => Promise<{ ok: boolean; error?: string }>;
};

const defaultDeps: SavedSearchAlertDeps = {
  getNow: () => new Date(),
  getSiteUrl,
  hasServiceRoleEnv,
  createServiceRoleClient,
  sendEmail: async ({ to, subject, html }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || "PropatyHub <no-reply@propatyhub.com>";
    if (!apiKey) {
      return { ok: false, error: "Email not configured" };
    }
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: body || response.statusText };
    }
    return { ok: true };
  },
};

function safeIso(input: string | null | undefined): string | null {
  if (!input) return null;
  const parsed = Date.parse(input);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function coerceBoolean(value: boolean | null | undefined, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function getAlertSecret() {
  return (
    process.env.SAVED_SEARCH_ALERTS_SECRET ||
    process.env.CRON_SECRET ||
    process.env.JOB_SECRET ||
    process.env.LISTING_EXPIRY_JOB_SECRET ||
    ""
  );
}

function isTruthyEnvFlag(value: string | undefined | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function resolveAlertsEmailEnabled(input: {
  appSettingValue: unknown;
  envOverride: string | undefined | null;
}) {
  if (isTruthyEnvFlag(input.envOverride)) return true;
  return parseAppSettingBool(input.appSettingValue, false);
}

export function resolveAlertsDispatchEnabled(input: {
  appSettingValue: unknown;
  killSwitchValue: unknown;
  envOverride: string | undefined | null;
}): {
  enabled: boolean;
  disabledReason: "kill_switch" | "feature_flag_off" | null;
} {
  const killSwitchEnabled = parseAppSettingBool(input.killSwitchValue, false);
  if (killSwitchEnabled) {
    return {
      enabled: false,
      disabledReason: "kill_switch",
    };
  }
  const enabled = resolveAlertsEmailEnabled({
    appSettingValue: input.appSettingValue,
    envOverride: input.envOverride,
  });
  return {
    enabled,
    disabledReason: enabled ? null : "feature_flag_off",
  };
}

async function resolveAlertsGate(input: {
  supabase: SupabaseClient;
  envOverride?: string | undefined | null;
}) {
  const { data, error } = await input.supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [APP_SETTING_KEYS.alertsEmailEnabled, APP_SETTING_KEYS.alertsKillSwitchEnabled]);

  if (error) {
    const fallbackEnabled = isTruthyEnvFlag(input.envOverride ?? process.env[ALERTS_EMAIL_ENABLED_ENV]);
    return {
      enabled: fallbackEnabled,
      disabledReason: fallbackEnabled ? null : ("feature_flag_off" as const),
    };
  }

  const rows = (data as Array<{ key: string; value: unknown }> | null) ?? [];
  const emailSetting = rows.find((row) => row.key === APP_SETTING_KEYS.alertsEmailEnabled)?.value;
  const killSwitchSetting = rows.find(
    (row) => row.key === APP_SETTING_KEYS.alertsKillSwitchEnabled
  )?.value;

  return resolveAlertsDispatchEnabled({
    appSettingValue: emailSetting,
    killSwitchValue: killSwitchSetting,
    envOverride: input.envOverride ?? process.env[ALERTS_EMAIL_ENABLED_ENV],
  });
}

export function normalizeSavedSearchAlertFrequency(
  value: string | null | undefined
): SavedSearchAlertFrequency {
  if (value === "instant" || value === "weekly") return value;
  return "daily";
}

export function getFrequencyIntervalMs(frequency: SavedSearchAlertFrequency) {
  if (frequency === "instant") return INSTANT_RATE_LIMIT_MS;
  if (frequency === "weekly") return WEEKLY_RATE_LIMIT_MS;
  return DAILY_RATE_LIMIT_MS;
}

export function isSavedSearchAlertDue(input: {
  frequency: SavedSearchAlertFrequency;
  lastSentAt?: string | null;
  now: Date;
}) {
  const lastSent = safeIso(input.lastSentAt ?? null);
  if (!lastSent) return true;
  const elapsed = input.now.getTime() - Date.parse(lastSent);
  return elapsed >= getFrequencyIntervalMs(input.frequency);
}

export function getSavedSearchAlertBaselineIso(input: {
  now: Date;
  createdAt?: string | null;
  alertLastSentAt?: string | null;
  alertBaselineAt?: string | null;
}) {
  const sent = safeIso(input.alertLastSentAt ?? null);
  if (sent) return sent;
  const baseline = safeIso(input.alertBaselineAt ?? null);
  if (baseline) return baseline;
  const created = safeIso(input.createdAt ?? null);
  if (created) return created;
  return new Date(input.now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function getUtcDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildSavedSearchAlertDedupeKey(input: {
  userId: string;
  searchId: string;
  dayKey: string;
}) {
  const payload = `${input.userId}|${input.searchId}|${input.dayKey}`;
  return createHmac("sha256", "saved-search-alert-dedupe").update(payload).digest("hex");
}

export function createSavedSearchUnsubscribeToken(input: {
  searchId: string;
  userId: string;
}) {
  const secret = getAlertSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(`${input.searchId}:${input.userId}`).digest("hex");
}

export function isValidSavedSearchUnsubscribeToken(input: {
  searchId: string;
  userId: string;
  token: string;
}) {
  const expected = createSavedSearchUnsubscribeToken({
    searchId: input.searchId,
    userId: input.userId,
  });
  if (!expected || !input.token) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(input.token, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function buildMatchesUrl(input: {
  siteUrl: string;
  filters: Record<string, unknown> | null | undefined;
}) {
  const parsed = parseFiltersFromSavedSearch(input.filters || {});
  const params = filtersToSearchParams(parsed);
  if (!params.get("intent")) {
    params.set("intent", parsed.listingIntent ?? "all");
  }
  const query = params.toString();
  return query ? `${input.siteUrl}/properties?${query}` : `${input.siteUrl}/properties`;
}

export function buildSavedSearchMatchesUrl(input: {
  siteUrl: string;
  filters: Record<string, unknown> | null | undefined;
}) {
  return buildMatchesUrl(input);
}

export async function getEligibleSavedSearchesToAlert(input: {
  supabase: SupabaseClient;
  now: Date;
  limit?: number;
}) {
  const limit = Number.isFinite(input.limit ?? NaN)
    ? Math.max(1, Math.min(DEFAULT_BATCH_SIZE, Number(input.limit)))
    : DEFAULT_BATCH_SIZE;

  const { data, error } = await input.supabase
    .from("saved_searches")
    .select(
      "id,user_id,name,query_params,is_active,alerts_enabled,alert_frequency,created_at,alert_last_sent_at,alert_baseline_at"
    )
    .eq("is_active", true)
    .eq("alerts_enabled", true)
    .order("created_at", { ascending: true })
    .limit(limit * 3);

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data as SavedSearchAlertSearchRow[] | null) ?? []).filter((row) => {
    if (!coerceBoolean(row.is_active, true)) return false;
    if (!coerceBoolean(row.alerts_enabled, true)) return false;
    const frequency = normalizeSavedSearchAlertFrequency(row.alert_frequency);
    return isSavedSearchAlertDue({
      frequency,
      lastSentAt: row.alert_last_sent_at ?? null,
      now: input.now,
    });
  });

  return rows.slice(0, limit);
}

export async function getNewMatchesForSavedSearch(input: {
  supabase: SupabaseClient;
  search: SavedSearchAlertSearchRow;
  now: Date;
}) {
  const baselineIso = getSavedSearchAlertBaselineIso({
    now: input.now,
    createdAt: input.search.created_at ?? null,
    alertLastSentAt: input.search.alert_last_sent_at ?? null,
    alertBaselineAt: input.search.alert_baseline_at ?? null,
  });

  const spec = buildSavedSearchMatchQuerySpec({
    sinceIso: baselineIso,
    filters: input.search.query_params || {},
  });

  const baseQuery = input.supabase
    .from("properties")
    .select("id,title,city,price,currency,cover_image_url,created_at")
    .eq("is_approved", true)
    .eq("is_active", true)
    .eq("status", "live")
    .eq("is_demo", false)
    .or(`expires_at.is.null,expires_at.gte.${input.now.toISOString()}`);

  const filteredQuery = applySavedSearchMatchSpecToQuery(
    baseQuery as never,
    spec
  ) as typeof baseQuery;

  const { data, error } = await filteredQuery.order("created_at", {
    ascending: false,
  });
  if (error) {
    throw new Error(error.message);
  }

  return {
    baselineIso,
    matches: ((data as SavedSearchAlertListingRow[] | null) ?? []).filter(
      (row) => typeof row.id === "string" && row.id.length > 0
    ),
  };
}

async function excludeAlreadySentMatches(input: {
  supabase: SupabaseClient;
  searchId: string;
  matches: SavedSearchAlertListingRow[];
}) {
  const propertyIds = input.matches.map((match) => match.id);
  if (!propertyIds.length) return input.matches;

  const { data } = await input.supabase
    .from("saved_search_alerts")
    .select("property_id,status")
    .eq("saved_search_id", input.searchId)
    .in("property_id", propertyIds)
    .eq("status", "sent");

  const sentIds = new Set(
    ((data as Array<{ property_id?: string | null }> | null) ?? [])
      .map((row) => row.property_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );

  return input.matches.filter((match) => !sentIds.has(match.id));
}

async function findExistingAlertLogByDedupeKey(input: {
  supabase: SupabaseClient;
  dedupeKey: string;
}) {
  const { data } = await input.supabase
    .from("saved_search_alerts")
    .select("id,status")
    .eq("alert_dedupe_key", input.dedupeKey)
    .maybeSingle();
  return (data as { id: string; status: string } | null) ?? null;
}

async function upsertSavedSearchAlertLog(input: {
  supabase: SupabaseClient;
  userId: string;
  searchId: string;
  anchorPropertyId: string;
  dedupeKey: string;
  status: "sent" | "failed" | "skipped";
  sentAt?: string | null;
  error?: string | null;
}) {
  const existing = await findExistingAlertLogByDedupeKey({
    supabase: input.supabase,
    dedupeKey: input.dedupeKey,
  });

  if (existing) {
    const { error } = await input.supabase
      .from("saved_search_alerts")
      .update({
        status: input.status,
        sent_at: input.sentAt ?? null,
        error: input.error ?? null,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const insertPayload = {
    user_id: input.userId,
    saved_search_id: input.searchId,
    property_id: input.anchorPropertyId,
    channel: "email",
    status: input.status,
    sent_at: input.sentAt ?? null,
    error: input.error ?? null,
    alert_dedupe_key: input.dedupeKey,
  };

  const { error: insertError } = await input.supabase
    .from("saved_search_alerts")
    .insert(insertPayload);

  if (!insertError) return;

  const { error: fallbackError } = await input.supabase
    .from("saved_search_alerts")
    .update({
      status: input.status,
      sent_at: input.sentAt ?? null,
      error: input.error ?? null,
      alert_dedupe_key: input.dedupeKey,
    })
    .eq("saved_search_id", input.searchId)
    .eq("property_id", input.anchorPropertyId);

  if (fallbackError) throw new Error(fallbackError.message);
}

async function loadUserEmail(input: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const response = await (input.supabase as SupabaseClient).auth.admin.getUserById(input.userId);
  return response.data.user?.email ?? null;
}

export async function dispatchSavedSearchEmailAlerts(
  input?: {
    limit?: number;
    now?: Date;
  },
  deps: SavedSearchAlertDeps = defaultDeps
): Promise<SavedSearchAlertsRunResult> {
  if (!deps.hasServiceRoleEnv()) {
    return {
      ok: false,
      processed: 0,
      processedUsers: 0,
      sent: 0,
      emailsSent: 0,
      failed: 0,
      failedUsers: 0,
      skipped: 0,
      duplicates: 0,
      noMatches: 0,
    };
  }
  if (!getAlertSecret()) {
    return {
      ok: false,
      processed: 0,
      processedUsers: 0,
      sent: 0,
      emailsSent: 0,
      failed: 0,
      failedUsers: 0,
      skipped: 0,
      duplicates: 0,
      noMatches: 0,
    };
  }

  const now = input?.now ?? deps.getNow();
  const supabase = deps.createServiceRoleClient() as unknown as SupabaseClient;
  const siteUrl = await deps.getSiteUrl();
  const gate = await resolveAlertsGate({ supabase });

  if (!gate.enabled) {
    return {
      ok: true,
      processed: 0,
      processedUsers: 0,
      sent: 0,
      emailsSent: 0,
      failed: 0,
      failedUsers: 0,
      skipped: 0,
      duplicates: 0,
      noMatches: 0,
      disabledReason: gate.disabledReason,
    };
  }

  const searches = await getEligibleSavedSearchesToAlert({
    supabase,
    now,
    limit: input?.limit,
  });

  const result: SavedSearchAlertsRunResult = {
    ok: true,
    processed: 0,
    processedUsers: 0,
    sent: 0,
    emailsSent: 0,
    failed: 0,
    failedUsers: 0,
    skipped: 0,
    duplicates: 0,
    noMatches: 0,
    disabledReason: null,
  };

  type CandidateSearch = {
    search: SavedSearchAlertSearchRow;
    dedupeKey: string;
    anchorPropertyId: string;
    digestGroup: SavedSearchDigestGroup;
  };

  const candidatesByUser = new Map<string, CandidateSearch[]>();
  const dayKey = getUtcDayKey(now);

  for (const search of searches) {
    result.processed += 1;

    let matchData: Awaited<ReturnType<typeof getNewMatchesForSavedSearch>>;
    try {
      matchData = await getNewMatchesForSavedSearch({
        supabase,
        search,
        now,
      });
    } catch {
      result.failed += 1;
      continue;
    }

    const pendingMatches = await excludeAlreadySentMatches({
      supabase,
      searchId: search.id,
      matches: matchData.matches,
    });

    if (!pendingMatches.length) {
      result.noMatches += 1;
      result.skipped += 1;
      if (!safeIso(search.alert_baseline_at ?? null)) {
        await supabase
          .from("saved_searches")
          .update({ alert_baseline_at: now.toISOString() })
          .eq("id", search.id)
          .eq("user_id", search.user_id);
      }
      continue;
    }

    const dedupeKey = buildSavedSearchAlertDedupeKey({
      userId: search.user_id,
      searchId: search.id,
      dayKey,
    });

    const existing = await findExistingAlertLogByDedupeKey({
      supabase,
      dedupeKey,
    });
    if (existing?.status === "sent") {
      result.duplicates += 1;
      result.skipped += 1;
      continue;
    }

    const anchorPropertyId = pendingMatches[0].id;
    const unsubscribeToken = createSavedSearchUnsubscribeToken({
      searchId: search.id,
      userId: search.user_id,
    });
    const unsubscribeUrl = `${siteUrl}/api/saved-searches/${search.id}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    const matchesUrl = buildMatchesUrl({
      siteUrl,
      filters: search.query_params || {},
    });

    const digestGroup: SavedSearchDigestGroup = {
      savedSearchId: search.id,
      searchName: search.name || "Saved search",
      matchCount: pendingMatches.length,
      matchesUrl,
      unsubscribeUrl,
      listings: pendingMatches,
    };

    const existingCandidates = candidatesByUser.get(search.user_id) ?? [];
    existingCandidates.push({
      search,
      dedupeKey,
      anchorPropertyId,
      digestGroup,
    });
    candidatesByUser.set(search.user_id, existingCandidates);
  }

  result.processedUsers = candidatesByUser.size;

  for (const [userId, candidates] of candidatesByUser.entries()) {
    const orderedCandidates = [...candidates].sort(
      (a, b) => b.digestGroup.matchCount - a.digestGroup.matchCount
    );
    const sendCandidates = orderedCandidates.slice(0, MAX_SEARCHES_PER_DIGEST);
    const overflowCandidates = orderedCandidates.slice(MAX_SEARCHES_PER_DIGEST);

    const email = await loadUserEmail({
      supabase,
      userId,
    });
    if (!email) {
      result.failedUsers += 1;
      for (const candidate of sendCandidates) {
        await upsertSavedSearchAlertLog({
          supabase,
          userId,
          searchId: candidate.search.id,
          anchorPropertyId: candidate.anchorPropertyId,
          dedupeKey: candidate.dedupeKey,
          status: "failed",
          error: "Missing recipient email",
        });
        result.failed += 1;
      }
      continue;
    }

    const { subject, html } = buildSavedSearchDigestEmail({
      siteUrl,
      groups: sendCandidates.map((candidate) => candidate.digestGroup),
      omittedSearchCount: overflowCandidates.length,
    });

    const sendResult = await deps.sendEmail({
      to: email,
      subject,
      html,
    });

    if (!sendResult.ok) {
      result.failedUsers += 1;
      for (const candidate of sendCandidates) {
        await upsertSavedSearchAlertLog({
          supabase,
          userId,
          searchId: candidate.search.id,
          anchorPropertyId: candidate.anchorPropertyId,
          dedupeKey: candidate.dedupeKey,
          status: "failed",
          error: sendResult.error || "Email delivery failed",
        });
        result.failed += 1;
      }
      continue;
    }

    for (const candidate of sendCandidates) {
      await upsertSavedSearchAlertLog({
        supabase,
        userId,
        searchId: candidate.search.id,
        anchorPropertyId: candidate.anchorPropertyId,
        dedupeKey: candidate.dedupeKey,
        status: "sent",
        sentAt: now.toISOString(),
        error: null,
      });

      await supabase
        .from("saved_searches")
        .update({
          alert_last_sent_at: now.toISOString(),
          alert_baseline_at: candidate.search.alert_baseline_at ?? now.toISOString(),
          last_notified_at: now.toISOString(),
        })
        .eq("id", candidate.search.id)
        .eq("user_id", userId);

      result.sent += 1;
    }

    for (const candidate of overflowCandidates) {
      await upsertSavedSearchAlertLog({
        supabase,
        userId,
        searchId: candidate.search.id,
        anchorPropertyId: candidate.anchorPropertyId,
        dedupeKey: candidate.dedupeKey,
        status: "skipped",
        sentAt: now.toISOString(),
        error: "Digest cap reached",
      });
      await supabase
        .from("saved_searches")
        .update({
          alert_last_sent_at: now.toISOString(),
          alert_baseline_at: candidate.search.alert_baseline_at ?? now.toISOString(),
          last_notified_at: now.toISOString(),
        })
        .eq("id", candidate.search.id)
        .eq("user_id", userId);
      result.skipped += 1;
    }
    result.emailsSent += 1;
  }

  return result;
}
