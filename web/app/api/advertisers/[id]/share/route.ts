import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fetchUserRole } from "@/lib/auth/role";
import { resolveEventSessionKey } from "@/lib/analytics/property-events.server";
import { logAuditEvent } from "@/lib/audit/audit-log";
import {
  ADVERTISER_SHARE_CHANNELS,
  ADVERTISER_SHARE_SURFACES,
} from "@/lib/advertisers/public-share";
import { isPublicAdvertiserRole } from "@/lib/advertisers/public-profile";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/advertisers/[id]/share";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const payloadSchema = z.object({
  channel: z.enum(ADVERTISER_SHARE_CHANNELS),
  surface: z.enum(ADVERTISER_SHARE_SURFACES),
});

type AdvertiserRow = {
  id?: string | null;
  role?: string | null;
  public_slug?: string | null;
};

export type PostAdvertiserShareDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  fetchUserRole: typeof fetchUserRole;
  resolveEventSessionKey: typeof resolveEventSessionKey;
  logAuditEvent: typeof logAuditEvent;
};

const defaultDeps: PostAdvertiserShareDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  fetchUserRole,
  resolveEventSessionKey,
  logAuditEvent,
};

async function getAdvertiserRow(
  supabase: Pick<SupabaseClient, "from">,
  advertiserId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, public_slug")
    .eq("id", advertiserId)
    .maybeSingle();
  return { row: (data as AdvertiserRow | null) ?? null, error };
}

export async function postAdvertiserShareResponse(
  request: Request,
  advertiserId: string,
  deps: PostAdvertiserShareDeps = defaultDeps
) {
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json(
      { error: "Supabase not configured.", route: routeLabel },
      { status: 503 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsedPayload = payloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid share payload." }, { status: 400 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const advertiserRes = await getAdvertiserRow(supabase, advertiserId);
  if (advertiserRes.error || !advertiserRes.row?.id) {
    return NextResponse.json({ error: "Advertiser not found." }, { status: 404 });
  }
  if (!isPublicAdvertiserRole(advertiserRes.row.role)) {
    return NextResponse.json(
      { error: "Profile is not a public advertiser." },
      { status: 404 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const actorRole = user ? await deps.fetchUserRole(supabase, user.id) : null;
  const sessionKey = deps.resolveEventSessionKey({
    request,
    userId: user?.id ?? null,
  });

  deps.logAuditEvent("advertisers.profile_share_click", {
    route: routeLabel,
    actorId: user?.id,
    outcome: "ok",
    reason: "advertiser_profile_share_click",
    meta: {
      source: "profile_share",
      channel: parsedPayload.data.channel,
      surface: parsedPayload.data.surface,
      advertiser_id: advertiserRes.row.id,
      advertiser_slug: advertiserRes.row.public_slug ?? null,
      actor_role: actorRole ?? "anon",
      session_key: sessionKey ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    logged: true,
    logger: "audit_log",
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid advertiser id." }, { status: 400 });
  }
  return postAdvertiserShareResponse(request, parsedParams.data.id, defaultDeps);
}
