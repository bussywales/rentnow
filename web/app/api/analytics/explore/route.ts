import { NextResponse } from "next/server";
import { z } from "zod";
import { hasServerSupabaseEnv, createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  getExploreAnalyticsSettings,
  type ExploreAnalyticsSettings,
} from "@/lib/explore/explore-analytics-settings";
import { checkExploreAnalyticsRateLimit } from "@/lib/explore/explore-analytics-rate-limit";
import { EXPLORE_ANALYTICS_EVENT_NAMES } from "@/lib/explore/explore-analytics-event-names";
import { fetchUserRole } from "@/lib/auth/role";

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
    ctaCopyVariant: z.enum(["default", "clarity", "action"]).nullable().optional(),
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
  hasServiceRoleEnv?: typeof hasServiceRoleEnv;
  createServiceRoleClient?: typeof createServiceRoleClient;
  createServerSupabaseClient?: typeof createServerSupabaseClient;
  getExploreAnalyticsSettings?: typeof getExploreAnalyticsSettings;
  checkExploreAnalyticsRateLimit?: typeof checkExploreAnalyticsRateLimit;
  fetchUserRole?: typeof fetchUserRole;
};

function readClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",", 1);
    if (first?.trim()) return first.trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return null;
}

export async function postExploreAnalyticsIngestResponse(
  request: Request,
  deps: ExploreAnalyticsIngestDeps = {}
) {
  const hasEnv = deps.hasServerSupabaseEnv ?? hasServerSupabaseEnv;
  const hasServiceEnv = deps.hasServiceRoleEnv ?? hasServiceRoleEnv;
  const createServiceClient = deps.createServiceRoleClient ?? createServiceRoleClient;
  const createRequestClient = deps.createServerSupabaseClient ?? createServerSupabaseClient;
  const getSettings = deps.getExploreAnalyticsSettings ?? getExploreAnalyticsSettings;
  const checkRateLimit = deps.checkExploreAnalyticsRateLimit ?? checkExploreAnalyticsRateLimit;
  const fetchRole = deps.fetchUserRole ?? fetchUserRole;

  if (!hasEnv()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const requestClient = await createRequestClient();
  const serviceClient = hasServiceEnv() ? createServiceClient() : requestClient;
  const {
    data: { user },
  } = await requestClient.auth.getUser();
  const role = user ? await fetchRole(requestClient, user.id) : null;

  const settings = await getSettings(serviceClient);
  const disabledResponse = buildDisabledResponse(settings);
  if (disabledResponse) return disabledResponse;

  if (settings.consentRequired && !consentAcceptedFromRequest(request)) {
    return buildConsentResponse();
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = ingestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid analytics payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const clientIp = readClientIp(request);
  const scopeKey = user?.id
    ? `user:${user.id}`
    : payload.sessionId?.trim()
      ? `session:${payload.sessionId.trim()}`
      : clientIp
        ? `ip:${clientIp}`
        : "anonymous";
  const rateLimit = await checkRateLimit({
    scopeKey,
    isAuthenticated: !!user,
  });
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

  const canAttachUserId = !!user && !!role && ["tenant", "agent", "landlord", "admin"].includes(role);
  const { error } = await serviceClient.from("explore_events").insert({
    event_name: payload.eventName,
    session_id: payload.sessionId ?? null,
    listing_id: payload.listingId ?? null,
    market_code: payload.marketCode ?? null,
    intent_type: payload.intentType ?? null,
    slide_index: payload.index ?? null,
    feed_size: payload.feedSize ?? null,
    trust_cue_variant: payload.trustCueVariant ?? null,
    trust_cue_enabled: payload.trustCueEnabled ?? null,
    cta_copy_variant: payload.ctaCopyVariant ?? null,
    user_id: canAttachUserId ? user.id : null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "Unable to ingest analytics event." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function POST(request: Request) {
  return postExploreAnalyticsIngestResponse(request);
}
