import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { BRAND } from "@/lib/brand";

const routeLabel = "/api/admin/fx/fetch-now";
const internalFxRoute = "/api/internal/fx/fetch-daily";
const RATE_LIMIT_WINDOW_MS = 60_000;

const adminFetchNowLastRunAt = new Map<string, number>();

export type AdminFxFetchNowDeps = {
  requireRole: typeof requireRole;
  now: () => Date;
  getCronSecret: () => string;
  getAppUrl: () => string;
  getPublicSiteUrl: () => string;
  getSiteUrl: () => string;
  doFetch: typeof fetch;
};

const defaultDeps: AdminFxFetchNowDeps = {
  requireRole,
  now: () => new Date(),
  getCronSecret: () => process.env.CRON_SECRET ?? "",
  getAppUrl: () => process.env.APP_URL ?? "",
  getPublicSiteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "",
  getSiteUrl: () => process.env.SITE_URL ?? "",
  doFetch: fetch,
};

function normalizeBaseUrl(value?: string | null) {
  const trimmed = value?.trim().replace(/\/$/, "") ?? "";
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

export function resolveFxFetchNowBaseUrl(deps: Pick<
  AdminFxFetchNowDeps,
  "getAppUrl" | "getPublicSiteUrl" | "getSiteUrl"
>) {
  return (
    normalizeBaseUrl(deps.getAppUrl()) ||
    normalizeBaseUrl(deps.getPublicSiteUrl()) ||
    normalizeBaseUrl(deps.getSiteUrl()) ||
    BRAND.siteUrl
  );
}

function isRateLimited(adminUserId: string, nowMs: number) {
  const lastRunAt = adminFetchNowLastRunAt.get(adminUserId) ?? 0;
  const elapsed = nowMs - lastRunAt;
  if (elapsed < RATE_LIMIT_WINDOW_MS) {
    return Math.ceil((RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
  }
  adminFetchNowLastRunAt.set(adminUserId, nowMs);
  return 0;
}

export function resetAdminFxFetchNowRateLimitForTests() {
  adminFetchNowLastRunAt.clear();
}

export async function postAdminFxFetchNowResponse(
  request: NextRequest,
  deps: AdminFxFetchNowDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const retryAfterSeconds = isRateLimited(auth.user.id, deps.now().getTime());
  if (retryAfterSeconds > 0) {
    return NextResponse.json(
      { ok: false, error: "Rate limited. Try again shortly.", retryAfterSeconds },
      { status: 429 }
    );
  }

  const cronSecret = deps.getCronSecret().trim();
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 503 }
    );
  }

  const baseUrl = resolveFxFetchNowBaseUrl(deps);
  const targetUrl = new URL(internalFxRoute, baseUrl).toString();
  const internalResponse = await deps.doFetch(targetUrl, {
    method: "POST",
    headers: { "x-cron-secret": cronSecret },
    cache: "no-store",
  });

  const payload = (await internalResponse.json().catch(() => null)) as
    | {
        ok?: boolean;
        fetchedAt?: string | null;
        date?: string;
        baseCurrency?: string;
        currenciesCount?: number;
        source?: string;
        error?: string;
      }
    | null;

  if (!internalResponse.ok || !payload?.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: payload?.error || "Unable to fetch FX rates right now.",
      },
      { status: internalResponse.status || 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    fetchedAt: payload.fetchedAt ?? null,
    base: payload.baseCurrency ?? null,
    count: Number(payload.currenciesCount ?? 0),
    provider: payload.source ?? null,
    date: payload.date ?? null,
  });
}

export async function POST(request: NextRequest) {
  return postAdminFxFetchNowResponse(request, defaultDeps);
}

export const dynamic = "force-dynamic";
