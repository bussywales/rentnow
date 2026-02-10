import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import {
  buildReferralCampaignShareLink,
  getReferralCampaignDetail,
  normalizeLandingPath,
} from "@/lib/referrals/share-tracking.server";
import { getSiteUrl } from "@/lib/env";

const routeLabel = "/api/referrals/campaigns/[id]";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    is_active: z.boolean().optional(),
    landing_path: z.string().trim().min(1).max(200).optional(),
    utm_source: z.string().trim().max(120).nullable().optional(),
    utm_medium: z.string().trim().max(120).nullable().optional(),
    utm_campaign: z.string().trim().max(120).nullable().optional(),
    utm_content: z.string().trim().max(120).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing campaign id" }, { status: 400 });

  const detail = await getReferralCampaignDetail({
    client: auth.supabase,
    ownerId: auth.user.id,
    campaignId: id,
  });

  if (!detail) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  return NextResponse.json({ ok: true, detail });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing campaign id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const payload: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) payload.name = parsed.data.name;
  if (parsed.data.is_active !== undefined) payload.is_active = parsed.data.is_active;
  if (parsed.data.landing_path !== undefined) {
    payload.landing_path = normalizeLandingPath(parsed.data.landing_path);
  }
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const) {
    if (parsed.data[key] !== undefined) {
      payload[key] = parsed.data[key] && parsed.data[key]?.trim() ? parsed.data[key] : null;
    }
  }

  const { data, error } = await auth.supabase
    .from("referral_share_campaigns")
    .update(payload)
    .eq("owner_id", auth.user.id)
    .eq("id", id)
    .select(
      "id, owner_id, referral_code, name, channel, utm_source, utm_medium, utm_campaign, utm_content, landing_path, is_active, created_at, updated_at"
    )
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const siteUrl = await getSiteUrl();
  const campaign = {
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
  };

  return NextResponse.json({ ok: true, campaign });
}
