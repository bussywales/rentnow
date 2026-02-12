import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { filtersToSearchParams, parseFiltersFromSavedSearch } from "@/lib/search-filters";
import { getSiteUrl } from "@/lib/env";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  applySavedSearchMatchSpecToQuery,
  buildSavedSearchMatchQuerySpec,
} from "@/lib/saved-searches/matching";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const INSTANT_RATE_LIMIT_MS = 6 * 60 * 60 * 1000;
const DAILY_RATE_LIMIT_MS = 24 * 60 * 60 * 1000;
const WEEKLY_RATE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 200;

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
  sent: number;
  failed: number;
  skipped: number;
  duplicates: number;
  noMatches: number;
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
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) {
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
    process.env.JOB_SECRET ||
    process.env.LISTING_EXPIRY_JOB_SECRET ||
    ""
  );
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

export function buildSavedSearchAlertDedupeKey(input: {
  searchId: string;
  frequency: SavedSearchAlertFrequency;
  baselineIso: string;
  listingIds: string[];
}) {
  const normalized = [...input.listingIds].sort().join(",");
  const payload = `${input.searchId}|${input.frequency}|${input.baselineIso}|${normalized}|${input.listingIds.length}`;
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

function formatPrice(input: { amount: number | null; currency: string | null }) {
  if (!Number.isFinite(input.amount ?? NaN)) return "Price unavailable";
  const value = Number(input.amount ?? 0);
  const currency = input.currency || "NGN";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function buildAlertSubject(input: {
  frequency: SavedSearchAlertFrequency;
  matchCount: number;
}) {
  if (input.frequency === "weekly") return "Your weekly property matches";
  if (input.frequency === "daily") return "Your daily property matches";
  return input.matchCount > 1
    ? "New homes matching your search"
    : "New home matching your search";
}

function buildMatchesUrl(input: {
  siteUrl: string;
  filters: Record<string, unknown> | null | undefined;
}) {
  const parsed = parseFiltersFromSavedSearch(input.filters || {});
  const params = filtersToSearchParams(parsed);
  const query = params.toString();
  return query ? `${input.siteUrl}/properties?${query}` : `${input.siteUrl}/properties`;
}

function buildSavedSearchAlertHtml(input: {
  siteUrl: string;
  searchName: string;
  frequency: SavedSearchAlertFrequency;
  listings: SavedSearchAlertListingRow[];
  filters: Record<string, unknown> | null | undefined;
  unsubscribeUrl: string;
}) {
  const matchesUrl = buildMatchesUrl({
    siteUrl: input.siteUrl,
    filters: input.filters,
  });
  const heading =
    input.frequency === "weekly"
      ? "Your weekly matches are in"
      : input.frequency === "daily"
      ? "Your daily matches are in"
      : "New matches for your saved search";

  const items = input.listings
    .slice(0, 6)
    .map((listing) => {
      const listingUrl = `${input.siteUrl}/properties/${listing.id}`;
      const price = formatPrice({ amount: listing.price, currency: listing.currency });
      const city = listing.city || "Location not set";
      return `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
          <a href="${listingUrl}" style="font-weight: 600; color: #0f172a; text-decoration: none;">
            ${listing.title}
          </a>
          <div style="color: #475569; font-size: 13px; margin-top: 4px;">${city} · ${price}</div>
        </td>
      </tr>`;
    })
    .join("");

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; line-height: 1.5;">
    <h2 style="margin: 0 0 8px;">${heading}</h2>
    <p style="margin: 0 0 16px; color: #334155;">
      ${input.listings.length} new listing${input.listings.length === 1 ? "" : "s"} matched “${input.searchName}”.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 18px;">
      ${items}
    </table>
    <a href="${matchesUrl}" style="display: inline-block; background: #0ea5e9; color: #ffffff; padding: 10px 14px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      View all matches
    </a>
    <p style="margin: 18px 0 0; color: #64748b; font-size: 12px;">
      Not useful right now?
      <a href="${input.unsubscribeUrl}" style="color: #0f766e;">Disable alerts for this search</a>.
    </p>
  </div>`;
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
  status: "sent" | "failed";
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
      sent: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      noMatches: 0,
    };
  }
  if (!getAlertSecret()) {
    return {
      ok: false,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      noMatches: 0,
    };
  }

  const now = input?.now ?? deps.getNow();
  const supabase = deps.createServiceRoleClient() as unknown as SupabaseClient;
  const siteUrl = await deps.getSiteUrl();

  const searches = await getEligibleSavedSearchesToAlert({
    supabase,
    now,
    limit: input?.limit,
  });

  const result: SavedSearchAlertsRunResult = {
    ok: true,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    duplicates: 0,
    noMatches: 0,
  };

  for (const search of searches) {
    result.processed += 1;
    const frequency = normalizeSavedSearchAlertFrequency(search.alert_frequency);

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
      searchId: search.id,
      frequency,
      baselineIso: matchData.baselineIso,
      listingIds: pendingMatches.map((listing) => listing.id),
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

    const email = await loadUserEmail({
      supabase,
      userId: search.user_id,
    });
    const anchorPropertyId = pendingMatches[0].id;

    if (!email) {
      await upsertSavedSearchAlertLog({
        supabase,
        userId: search.user_id,
        searchId: search.id,
        anchorPropertyId,
        dedupeKey,
        status: "failed",
        error: "Missing recipient email",
      });
      result.failed += 1;
      continue;
    }

    const unsubscribeToken = createSavedSearchUnsubscribeToken({
      searchId: search.id,
      userId: search.user_id,
    });
    const unsubscribeUrl = `${siteUrl}/api/saved-searches/${search.id}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    const subject = buildAlertSubject({
      frequency,
      matchCount: pendingMatches.length,
    });
    const html = buildSavedSearchAlertHtml({
      siteUrl,
      searchName: search.name || "Saved search",
      frequency,
      listings: pendingMatches,
      filters: search.query_params || {},
      unsubscribeUrl,
    });

    const sendResult = await deps.sendEmail({
      to: email,
      subject,
      html,
    });

    if (!sendResult.ok) {
      await upsertSavedSearchAlertLog({
        supabase,
        userId: search.user_id,
        searchId: search.id,
        anchorPropertyId,
        dedupeKey,
        status: "failed",
        error: sendResult.error || "Email delivery failed",
      });
      result.failed += 1;
      continue;
    }

    await upsertSavedSearchAlertLog({
      supabase,
      userId: search.user_id,
      searchId: search.id,
      anchorPropertyId,
      dedupeKey,
      status: "sent",
      sentAt: now.toISOString(),
      error: null,
    });

    await supabase
      .from("saved_searches")
      .update({
        alert_last_sent_at: now.toISOString(),
        alert_baseline_at: search.alert_baseline_at ?? now.toISOString(),
        last_notified_at: now.toISOString(),
      })
      .eq("id", search.id)
      .eq("user_id", search.user_id);

    result.sent += 1;
  }

  return result;
}
