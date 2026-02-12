import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getAdminReferralAttributionOverview } from "@/lib/referrals/share-tracking.server";

const routeLabel = "/api/admin/referrals/attribution";

export type AdminReferralAttributionRouteDeps = {
  requireRole: typeof requireRole;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getAdminReferralAttributionOverview: typeof getAdminReferralAttributionOverview;
};

const defaultDeps: AdminReferralAttributionRouteDeps = {
  requireRole,
  hasServiceRoleEnv,
  createServiceRoleClient,
  getAdminReferralAttributionOverview,
};

function parseWindow(value: string | null): 7 | 30 | null {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "7" || raw === "7d") return 7;
  if (raw === "all") return null;
  return 30;
}

export async function getAdminReferralAttributionResponse(
  request: Request,
  deps: AdminReferralAttributionRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const window = parseWindow(url.searchParams.get("window"));
  const campaignId = String(url.searchParams.get("campaignId") || "").trim();
  const utmSource = String(url.searchParams.get("utm_source") || "").trim();
  const referrer = String(url.searchParams.get("referrer") || "").trim();
  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();

  const adminClient = deps.createServiceRoleClient();
  const summary = await deps.getAdminReferralAttributionOverview({
    client: adminClient,
    topLimit: 20,
    timeframeDays: window,
    campaignId: campaignId || null,
    utmSource: utmSource || null,
    referrerUserId: referrer || null,
    fromDate: from || null,
    toDate: to || null,
  });

  return NextResponse.json({ ok: true, summary });
}

export async function GET(request: Request) {
  return getAdminReferralAttributionResponse(request);
}
