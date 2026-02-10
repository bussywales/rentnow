import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import {
  REFERRAL_LEADERBOARD_OPT_OUT_PREFIX,
  getReferralLeaderboardOptOut,
} from "@/lib/referrals/leaderboard.server";

const routeLabel = "/api/referrals/leaderboard-preference";

const patchSchema = z.object({
  visible: z.boolean(),
});

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
  const optedOut = await getReferralLeaderboardOptOut({
    client: adminClient as unknown as SupabaseClient,
    userId: auth.user.id,
  });

  return NextResponse.json({ ok: true, optedOut, visible: !optedOut });
}

export async function PATCH(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const key = `${REFERRAL_LEADERBOARD_OPT_OUT_PREFIX}${auth.user.id}`;
  const value = { enabled: !parsed.data.visible };
  const now = new Date().toISOString();
  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
  const { error } = await adminClient
    .from("app_settings")
    .upsert({ key, value, updated_at: now }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    optedOut: !parsed.data.visible,
    visible: parsed.data.visible,
  });
}
