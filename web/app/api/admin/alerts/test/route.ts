import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { getSiteUrl } from "@/lib/env";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  buildSavedSearchAlertDedupeKey,
  buildSavedSearchMatchesUrl,
  createSavedSearchUnsubscribeToken,
  getNewMatchesForSavedSearch,
  isSavedSearchAlertDue,
  normalizeSavedSearchAlertFrequency,
  type SavedSearchAlertSearchRow,
} from "@/lib/saved-searches/alerts.server";
import { buildSavedSearchDigestEmail } from "@/lib/email/templates/saved-search-digest";

const routeLabel = "/api/admin/alerts/test";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAX_GROUPS = 5;

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export type AdminAlertsTestDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  requireRole: typeof requireRole;
  createServiceRoleClient: typeof createServiceRoleClient;
  getNow: () => Date;
  getSiteUrl: typeof getSiteUrl;
  sendEmail: (input: SendEmailInput) => Promise<{ ok: boolean; error?: string }>;
};

const defaultDeps: AdminAlertsTestDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  requireRole,
  createServiceRoleClient,
  getNow: () => new Date(),
  getSiteUrl,
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

async function loadDueSavedSearches(input: {
  supabase: SupabaseClient;
  userId: string;
  now: Date;
}) {
  const { data, error } = await input.supabase
    .from("saved_searches")
    .select(
      "id,user_id,name,query_params,is_active,alerts_enabled,alert_frequency,created_at,alert_last_sent_at,alert_baseline_at"
    )
    .eq("user_id", input.userId)
    .eq("is_active", true)
    .eq("alerts_enabled", true)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) return [];
  const rows = ((data as SavedSearchAlertSearchRow[] | null) ?? []).filter((row) => {
    if (row.is_active === false || row.alerts_enabled === false) return false;
    const frequency = normalizeSavedSearchAlertFrequency(row.alert_frequency);
    return isSavedSearchAlertDue({
      frequency,
      lastSentAt: row.alert_last_sent_at ?? null,
      now: input.now,
    });
  });

  return rows;
}

function buildTestDigestHtml(input: { siteUrl: string }) {
  const manageUrl = `${input.siteUrl}/saved-searches`;
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin: 0 0 8px;">PropatyHub test digest</h2>
      <p style="margin: 0 0 16px; color: #334155;">
        This is a test email from Alerts Ops. No due saved-search matches were found for your account right now.
      </p>
      <p style="margin: 0; color: #334155;">
        Manage saved searches: <a href="${manageUrl}" style="color: #0f766e;">${manageUrl}</a>
      </p>
      <p style="margin: 12px 0 0; color: #64748b; font-size: 12px;">
        PropatyHub is a marketplace. Always verify viewing details before paying.
      </p>
    </div>
  `;
}

export async function postAdminAlertsTestResponse(
  request: NextRequest,
  deps: AdminAlertsTestDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const recipientEmail = auth.user.email?.trim();
  if (!recipientEmail) {
    return NextResponse.json({ error: "Admin email not available" }, { status: 400 });
  }

  const now = deps.getNow();
  const siteUrl = await deps.getSiteUrl();
  const supabase = deps.createServiceRoleClient() as unknown as SupabaseClient;
  const dueSearches = await loadDueSavedSearches({
    supabase,
    userId: auth.user.id,
    now,
  });

  const groups: Array<{
    savedSearchId: string;
    searchName: string;
    matchCount: number;
    matchesUrl: string;
    unsubscribeUrl: string;
    listings: Array<{
      id: string;
      title: string;
      city: string | null;
      price: number | null;
      currency: string | null;
    }>;
  }> = [];

  for (const search of dueSearches) {
    const matchesData = await getNewMatchesForSavedSearch({
      supabase,
      search,
      now,
    }).catch(() => null);
    if (!matchesData || !matchesData.matches.length) continue;
    const unsubscribeToken = createSavedSearchUnsubscribeToken({
      searchId: search.id,
      userId: search.user_id,
    });
    groups.push({
      savedSearchId: search.id,
      searchName: search.name || "Saved search",
      matchCount: matchesData.matches.length,
      matchesUrl: buildSavedSearchMatchesUrl({
        siteUrl,
        filters: search.query_params || {},
      }),
      unsubscribeUrl: `${siteUrl}/api/saved-searches/${search.id}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`,
      listings: matchesData.matches,
    });
    if (groups.length >= MAX_GROUPS) break;
  }

  const payload =
    groups.length > 0
      ? buildSavedSearchDigestEmail({
          siteUrl,
          groups,
          omittedSearchCount: Math.max(0, dueSearches.length - groups.length),
        })
      : {
          subject: "Test digest on PropatyHub",
          html: buildTestDigestHtml({ siteUrl }),
        };

  const sendResult = await deps.sendEmail({
    to: recipientEmail,
    subject: payload.subject,
    html: payload.html,
  });
  if (!sendResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: sendResult.error || "Unable to send test digest",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    recipient: recipientEmail,
    searches_included: groups.length,
    mode: groups.length > 0 ? "due_saved_searches" : "empty_test",
    dedupe_preview: groups.length
      ? buildSavedSearchAlertDedupeKey({
          userId: auth.user.id,
          searchId: groups[0].savedSearchId,
          dayKey: now.toISOString().slice(0, 10),
        })
      : null,
  });
}

export async function POST(request: NextRequest) {
  return postAdminAlertsTestResponse(request);
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

