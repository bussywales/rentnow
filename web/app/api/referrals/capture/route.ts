import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import {
  getReferralCampaignCookieName,
  getReferralCookieName,
  readReferralAnonIdFromCookieHeader,
  readReferralCampaignIdFromCookieHeader,
  readReferralCodeFromCookieHeader,
} from "@/lib/referrals/cookie";
import { captureReferralForUser } from "@/lib/referrals/referrals.server";
import { getReferralSettings } from "@/lib/referrals/settings";
import {
  findMostRecentTouchEventId,
  getReferralTrackingSettings,
  insertReferralTouchEvent,
  isUuidLike,
  resolveCampaignIfValid,
  upsertReferralAttribution,
} from "@/lib/referrals/share-tracking.server";

const routeLabel = "/api/referrals/capture";

export type ReferralCaptureRouteDeps = {
  requireUser: typeof requireUser;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  readReferralCodeFromCookieHeader: typeof readReferralCodeFromCookieHeader;
  readReferralCampaignIdFromCookieHeader: typeof readReferralCampaignIdFromCookieHeader;
  readReferralAnonIdFromCookieHeader: typeof readReferralAnonIdFromCookieHeader;
  captureReferralForUser: typeof captureReferralForUser;
  getReferralSettings: typeof getReferralSettings;
  getReferralTrackingSettings: typeof getReferralTrackingSettings;
  resolveCampaignIfValid: typeof resolveCampaignIfValid;
  insertReferralTouchEvent: typeof insertReferralTouchEvent;
  findMostRecentTouchEventId: typeof findMostRecentTouchEventId;
  upsertReferralAttribution: typeof upsertReferralAttribution;
  isUuidLike: typeof isUuidLike;
  now: () => number;
};

const defaultDeps: ReferralCaptureRouteDeps = {
  requireUser,
  hasServiceRoleEnv,
  createServiceRoleClient,
  readReferralCodeFromCookieHeader,
  readReferralCampaignIdFromCookieHeader,
  readReferralAnonIdFromCookieHeader,
  captureReferralForUser,
  getReferralSettings,
  getReferralTrackingSettings,
  resolveCampaignIfValid,
  insertReferralTouchEvent,
  findMostRecentTouchEventId,
  upsertReferralAttribution,
  isUuidLike,
  now: () => Date.now(),
};

function clearReferralCookie(response: NextResponse) {
  response.cookies.set({
    name: getReferralCookieName(),
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function clearReferralCampaignCookie(response: NextResponse) {
  response.cookies.set({
    name: getReferralCampaignCookieName(),
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function postReferralCaptureResponse(
  request: Request,
  deps: ReferralCaptureRouteDeps = defaultDeps
) {
  const startTime = deps.now();
  const auth = await deps.requireUser({
    request,
    route: routeLabel,
    startTime,
  });
  if (!auth.ok) return auth.response;

  const referralCode = deps.readReferralCodeFromCookieHeader(request.headers.get("cookie"));
  const referralCampaignId = deps.readReferralCampaignIdFromCookieHeader(
    request.headers.get("cookie")
  );
  const referralAnonId = deps.readReferralAnonIdFromCookieHeader(request.headers.get("cookie"));
  if (!referralCode) {
    const response = NextResponse.json({ ok: true, captured: false, reason: "no_cookie" });
    clearReferralCampaignCookie(response);
    return response;
  }

  if (!deps.hasServiceRoleEnv()) {
    const response = NextResponse.json(
      { ok: false, captured: false, reason: "service_role_missing" },
      { status: 503 }
    );
    clearReferralCookie(response);
    return response;
  }

  const adminClient = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
  const db = adminClient as unknown as SupabaseClient;
  const settings = await deps.getReferralSettings(db);
  const result = await deps.captureReferralForUser({
    client: db,
    referredUserId: auth.user.id,
    referralCode,
    maxDepth: settings.maxDepth,
  });

  if (result.ok && result.captured && result.referrerUserId) {
    try {
      const trackingSettings = await deps.getReferralTrackingSettings(db);
      if (trackingSettings.enabled) {
        const campaign =
          referralCampaignId && deps.isUuidLike(referralCampaignId)
            ? await deps.resolveCampaignIfValid({
                client: db,
                campaignId: referralCampaignId,
                referralCode,
              })
            : null;

        const capturedEvent = await deps.insertReferralTouchEvent(db, {
          campaignId: campaign?.id ?? null,
          referralCode,
          eventType: "captured",
          anonId: referralAnonId,
          referredUserId: auth.user.id,
        });
        const firstTouchEventId = await deps.findMostRecentTouchEventId({
          client: db,
          campaignId: campaign?.id ?? null,
          referralCode,
          anonId: referralAnonId,
          eventType: "click",
        });

        await deps.upsertReferralAttribution({
          client: db,
          campaignId: campaign?.id ?? null,
          referralCode,
          referredUserId: auth.user.id,
          referrerOwnerId: result.referrerUserId,
          firstTouchEventId,
          capturedEventId: capturedEvent?.id ?? null,
        });
      }
    } catch {
      // Tracking enrichment is best effort and must not block capture.
    }
  }

  const response = NextResponse.json(result, {
    status: result.ok ? 200 : 400,
  });
  clearReferralCookie(response);
  clearReferralCampaignCookie(response);
  return response;
}

export async function POST(request: Request) {
  return postReferralCaptureResponse(request);
}
