import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  createAnonId,
  getClientIpFromHeaders,
  getReferralTrackingSettings,
  hashIpAddress,
  insertReferralTouchEvent,
  isUuidLike,
  normalizeLandingPath,
  resolveCampaignIfValid,
} from "@/lib/referrals/share-tracking.server";
import {
  getReferralAnonCookieName,
  getReferralCampaignCookieName,
  getReferralCookieName,
  readReferralAnonIdFromCookieHeader,
} from "@/lib/referrals/cookie";

const CODE_REGEX = /^[A-Z0-9_-]{4,32}$/;

export type ReferralRedirectDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  readReferralAnonIdFromCookieHeader: typeof readReferralAnonIdFromCookieHeader;
  createAnonId: typeof createAnonId;
  getReferralTrackingSettings: typeof getReferralTrackingSettings;
  isUuidLike: typeof isUuidLike;
  resolveCampaignIfValid: typeof resolveCampaignIfValid;
  insertReferralTouchEvent: typeof insertReferralTouchEvent;
  getClientIpFromHeaders: typeof getClientIpFromHeaders;
  hashIpAddress: typeof hashIpAddress;
};

const defaultDeps: ReferralRedirectDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  readReferralAnonIdFromCookieHeader,
  createAnonId,
  getReferralTrackingSettings,
  isUuidLike,
  resolveCampaignIfValid,
  insertReferralTouchEvent,
  getClientIpFromHeaders,
  hashIpAddress,
};

export async function getReferralRedirectResponse(
  request: Request,
  codeInput: string,
  deps: ReferralRedirectDeps = defaultDeps
) {
  const code = (codeInput || "").trim().toUpperCase();
  const url = new URL(request.url);
  const requestedCampaignId = String(url.searchParams.get("c") || "").trim();
  const requestedNextPath = normalizeLandingPath(url.searchParams.get("next"));
  const redirectUrl =
    requestedNextPath !== "/"
      ? new URL(requestedNextPath, request.url)
      : new URL(`/auth/register?ref=${encodeURIComponent(code)}`, request.url);

  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
    const value = url.searchParams.get(key);
    if (value?.trim()) {
      redirectUrl.searchParams.set(key, value.trim().slice(0, 120));
    }
  }

  const response = NextResponse.redirect(redirectUrl, 307);
  const anonCookie = deps.readReferralAnonIdFromCookieHeader(request.headers.get("cookie"));
  const anonId = anonCookie || deps.createAnonId();

  const cookieOptions = {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };

  response.cookies.set({
    name: getReferralAnonCookieName(),
    value: anonId,
    ...cookieOptions,
  });

  if (!CODE_REGEX.test(code)) {
    return response;
  }

  response.cookies.set({
    name: getReferralCookieName(),
    value: code,
    ...cookieOptions,
  });

  try {
    if (deps.hasServiceRoleEnv()) {
      const adminClient = deps.createServiceRoleClient() as unknown as SupabaseClient;
      const settings = await deps.getReferralTrackingSettings(adminClient);
      if (settings.enabled) {
        const campaign =
          requestedCampaignId && deps.isUuidLike(requestedCampaignId)
            ? await deps.resolveCampaignIfValid({
                client: adminClient,
                campaignId: requestedCampaignId,
                referralCode: code,
              })
            : null;

        if (campaign) {
          response.cookies.set({
            name: getReferralCampaignCookieName(),
            value: campaign.id,
            ...cookieOptions,
          });
        } else if (requestedCampaignId) {
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

        await deps.insertReferralTouchEvent(adminClient, {
          campaignId: campaign?.id ?? null,
          referralCode: code,
          eventType: "click",
          anonId,
          userAgent: request.headers.get("user-agent"),
          ipHash: settings.storeIpHash
            ? deps.hashIpAddress(deps.getClientIpFromHeaders(request.headers))
            : null,
          countryCode: request.headers.get("x-vercel-ip-country"),
          city: request.headers.get("x-vercel-ip-city"),
          referrerUrl: request.headers.get("referer"),
          landingUrl: `${redirectUrl.pathname}${redirectUrl.search}`,
        });
      }
    }
  } catch {
    // Click tracking failures should never block referral capture cookies.
  }

  return response;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const params = await context.params;
  return getReferralRedirectResponse(request, params.code);
}
