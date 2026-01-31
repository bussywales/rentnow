import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const payloadSchema = z.object({
  userId: z.string().uuid(),
  verified: z.boolean(),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const { user, supabase } = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const verifiedAt = body.data.verified ? new Date().toISOString() : null;

  const { error } = await client.from("user_verifications").upsert({
    user_id: body.data.userId,
    bank_verified_at: verifiedAt,
    bank_provider: body.data.verified ? "manual" : null,
  }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await client
    .from("profiles")
    .update({ bank_verified: body.data.verified })
    .eq("id", body.data.userId);

  await client.from("admin_actions_log").insert({
    property_id: null,
    subject_user_id: body.data.userId,
    action_type: "bank_verification_set",
    payload_json: {
      verified: body.data.verified,
      note: body.data.note ?? null,
      actor_id: user.id,
    },
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true, verified: body.data.verified });
}
