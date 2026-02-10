import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { ensureReferralCode } from "@/lib/referrals/referrals.server";
import {
  buildReferralCampaignShareLink,
  getReferralCodeForOwner,
  normalizeCampaignInput,
} from "@/lib/referrals/share-tracking.server";
import { getSiteUrl } from "@/lib/env";

const routeLabel = "/api/referrals/campaigns";

async function resolveReferralCodeForOwner(input: {
  ownerId: string;
  userClient: SupabaseClient;
}) {
  const codeFromSession = await getReferralCodeForOwner(input.userClient, input.ownerId);
  if (codeFromSession) return codeFromSession;

  if (!hasServiceRoleEnv()) return null;
  const adminClient = createServiceRoleClient();
  const ensured = await ensureReferralCode({
    client: adminClient,
    userId: input.ownerId,
  });
  return ensured.code;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("referral_share_campaigns")
    .select(
      "id, owner_id, referral_code, name, channel, utm_source, utm_medium, utm_campaign, utm_content, landing_path, is_active, created_at, updated_at"
    )
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const siteUrl = await getSiteUrl();
  const campaigns = ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    ...row,
    shareLink: buildReferralCampaignShareLink({
      siteUrl,
      referralCode: String(row.referral_code || ""),
      campaignId: String(row.id || ""),
      landingPath: String(row.landing_path || "/"),
      utmSource: (row.utm_source as string | null | undefined) ?? null,
      utmMedium: (row.utm_medium as string | null | undefined) ?? null,
      utmCampaign: (row.utm_campaign as string | null | undefined) ?? null,
      utmContent: (row.utm_content as string | null | undefined) ?? null,
    }),
  }));

  return NextResponse.json({ ok: true, campaigns });
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord", "admin"],
  });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const payload = (body || {}) as Record<string, unknown>;
  const normalized = normalizeCampaignInput({
    name: String(payload.name || ""),
    channel: String(payload.channel || ""),
    utm_source: typeof payload.utm_source === "string" ? payload.utm_source : null,
    utm_medium: typeof payload.utm_medium === "string" ? payload.utm_medium : null,
    utm_campaign: typeof payload.utm_campaign === "string" ? payload.utm_campaign : null,
    utm_content: typeof payload.utm_content === "string" ? payload.utm_content : null,
    landing_path: typeof payload.landing_path === "string" ? payload.landing_path : null,
  });
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 422 });
  }

  const referralCode = await resolveReferralCodeForOwner({
    ownerId: auth.user.id,
    userClient: auth.supabase,
  });
  if (!referralCode) {
    return NextResponse.json(
      { error: "Unable to resolve referral code for owner." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await auth.supabase
    .from("referral_share_campaigns")
    .insert({
      owner_id: auth.user.id,
      referral_code: referralCode,
      name: normalized.value.name,
      channel: normalized.value.channel,
      utm_source: normalized.value.utm_source,
      utm_medium: normalized.value.utm_medium,
      utm_campaign: normalized.value.utm_campaign,
      utm_content: normalized.value.utm_content,
      landing_path: normalized.value.landing_path,
      is_active: true,
      created_at: now,
      updated_at: now,
    })
    .select(
      "id, owner_id, referral_code, name, channel, utm_source, utm_medium, utm_campaign, utm_content, landing_path, is_active, created_at, updated_at"
    )
    .maybeSingle();

  if (error || !data) {
    const message = String(error?.message || "Unable to create campaign").toLowerCase();
    if (message.includes("owner_name") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: "Campaign name already exists for your account." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error?.message || "Unable to create campaign" }, { status: 400 });
  }

  const siteUrl = await getSiteUrl();
  return NextResponse.json({
    ok: true,
    campaign: {
      ...data,
      shareLink: buildReferralCampaignShareLink({
        siteUrl,
        referralCode: String(data.referral_code || ""),
        campaignId: String(data.id || ""),
        landingPath: String(data.landing_path || "/"),
        utmSource: (data.utm_source as string | null | undefined) ?? null,
        utmMedium: (data.utm_medium as string | null | undefined) ?? null,
        utmCampaign: (data.utm_campaign as string | null | undefined) ?? null,
        utmContent: (data.utm_content as string | null | undefined) ?? null,
      }),
    },
  });
}
