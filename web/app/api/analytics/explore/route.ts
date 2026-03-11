import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  getExploreAnalyticsSettings,
  type ExploreAnalyticsSettings,
} from "@/lib/explore/explore-analytics-settings";
import { checkExploreAnalyticsRateLimit } from "@/lib/explore/explore-analytics-rate-limit";
import { EXPLORE_ANALYTICS_EVENT_NAMES } from "@/lib/explore/explore-analytics-event-names";

const routeLabel = "/api/analytics/explore";

const ingestSchema = z
  .object({
    eventName: z.enum(EXPLORE_ANALYTICS_EVENT_NAMES),
    sessionId: z.string().trim().min(1).max(120).nullable().optional(),
    listingId: z.string().uuid().nullable().optional(),
    marketCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/)
      .nullable()
      .optional(),
    intentType: z.enum(["shortlet", "rent", "buy"]).nullable().optional(),
    index: z.number().int().min(0).max(9999).nullable().optional(),
    feedSize: z.number().int().min(0).max(9999).nullable().optional(),
    depth: z.number().int().min(0).max(9999).nullable().optional(),
    fromIndex: z.number().int().min(0).max(9999).nullable().optional(),
    toIndex: z.number().int().min(0).max(9999).nullable().optional(),
    action: z.string().trim().min(1).max(64).nullable().optional(),
    result: z.string().trim().min(1).max(64).nullable().optional(),
    trustCueVariant: z.enum(["none", "instant_confirmation"]).nullable().optional(),
    trustCueEnabled: z.boolean().nullable().optional(),
  })
  .strict();

function consentAcceptedFromRequest(request: Request) {
  const header = request.headers.get("x-explore-analytics-consent");
  return (header || "").trim().toLowerCase() === "accepted";
}

function buildDisabledResponse(settings: ExploreAnalyticsSettings) {
  if (!settings.enabled) {
    return NextResponse.json(
      {
        ok: false,
        code: "analytics_disabled",
        message: "Explore analytics collection is disabled.",
      },
      { status: 403 }
    );
  }
  return null;
}

function buildConsentResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "consent_required",
      message: "Explore analytics consent is required.",
    },
    { status: 403 }
  );
}

type ExploreAnalyticsIngestDeps = {
  hasServerSupabaseEnv?: typeof hasServerSupabaseEnv;
  requireRole?: typeof requireRole;
  getExploreAnalyticsSettings?: typeof getExploreAnalyticsSettings;
  checkExploreAnalyticsRateLimit?: typeof checkExploreAnalyticsRateLimit;
};

export async function postExploreAnalyticsIngestResponse(
  request: Request,
  deps: ExploreAnalyticsIngestDeps = {}
) {
  const startTime = Date.now();
  const hasEnv = deps.hasServerSupabaseEnv ?? hasServerSupabaseEnv;
  const requireRoleFn = deps.requireRole ?? requireRole;
  const getSettings = deps.getExploreAnalyticsSettings ?? getExploreAnalyticsSettings;
  const checkRateLimit = deps.checkExploreAnalyticsRateLimit ?? checkExploreAnalyticsRateLimit;

  if (!hasEnv()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const auth = await requireRoleFn({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant", "agent", "landlord"],
  });
  if (!auth.ok) return auth.response;

  const settings = await getSettings(auth.supabase);
  const disabledResponse = buildDisabledResponse(settings);
  if (disabledResponse) return disabledResponse;

  if (settings.consentRequired && !consentAcceptedFromRequest(request)) {
    return buildConsentResponse();
  }

  const rateLimit = checkRateLimit({ userId: auth.user.id });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "rate_limited",
        message: "Too many analytics events. Please retry shortly.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = ingestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid analytics payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const { error } = await auth.supabase.from("explore_events").insert({
    event_name: payload.eventName,
    session_id: payload.sessionId ?? null,
    listing_id: payload.listingId ?? null,
    market_code: payload.marketCode ?? null,
    intent_type: payload.intentType ?? null,
    slide_index: payload.index ?? null,
    feed_size: payload.feedSize ?? null,
    trust_cue_variant: payload.trustCueVariant ?? null,
    trust_cue_enabled: payload.trustCueEnabled ?? null,
    user_id: auth.user.id,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "Unable to ingest analytics event." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function POST(request: Request) {
  return postExploreAnalyticsIngestResponse(request);
}
