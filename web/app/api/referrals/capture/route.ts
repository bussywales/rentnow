import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { getReferralCookieName, readReferralCodeFromCookieHeader } from "@/lib/referrals/cookie";
import { captureReferralForUser } from "@/lib/referrals/referrals.server";
import { getReferralSettings } from "@/lib/referrals/settings";

const routeLabel = "/api/referrals/capture";

export type ReferralCaptureRouteDeps = {
  requireUser: typeof requireUser;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  readReferralCodeFromCookieHeader: typeof readReferralCodeFromCookieHeader;
  captureReferralForUser: typeof captureReferralForUser;
  getReferralSettings: typeof getReferralSettings;
  now: () => number;
};

const defaultDeps: ReferralCaptureRouteDeps = {
  requireUser,
  hasServiceRoleEnv,
  createServiceRoleClient,
  readReferralCodeFromCookieHeader,
  captureReferralForUser,
  getReferralSettings,
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
  if (!referralCode) {
    return NextResponse.json({ ok: true, captured: false, reason: "no_cookie" });
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

  const response = NextResponse.json(result, {
    status: result.ok ? 200 : 400,
  });
  clearReferralCookie(response);
  return response;
}

export async function POST(request: Request) {
  return postReferralCaptureResponse(request);
}
