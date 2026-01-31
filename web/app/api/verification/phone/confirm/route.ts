import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { normalizeE164 } from "@/lib/verification/phone";
import { hashOtp } from "@/lib/verification/otp";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

const payloadSchema = z.object({
  phoneE164: z.string().min(1),
  code: z.string().min(4),
  mode: z.enum(["supabase_phone_otp", "email_fallback"]).optional(),
});

function getAnonClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function POST(request: Request) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const { user, supabase } = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const normalized = normalizeE164(body.data.phoneE164);
  if (!normalized) {
    return NextResponse.json({ error: "Invalid phone format." }, { status: 400 });
  }

  let verified = false;

  if (body.data.mode === "supabase_phone_otp") {
    const anonClient = getAnonClient();
    if (!anonClient) {
      return NextResponse.json({ error: "Supabase anon env missing" }, { status: 503 });
    }
    const { error } = await anonClient.auth.verifyOtp({
      phone: normalized,
      token: body.data.code,
      type: "sms",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    verified = true;
  }

  if (!verified) {
    const now = new Date().toISOString();
    const { data: otpRow } = await supabase
      .from("verification_otps")
      .select("id, code_hash, expires_at, consumed_at")
      .eq("user_id", user.id)
      .eq("target", normalized)
      .eq("kind", "phone_email_fallback")
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRow) {
      return NextResponse.json({ error: "Code expired or invalid." }, { status: 400 });
    }

    if (otpRow.expires_at && new Date(otpRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Code expired." }, { status: 400 });
    }

    const hashed = hashOtp(body.data.code, user.id, normalized);
    if (hashed !== otpRow.code_hash) {
      return NextResponse.json({ error: "Invalid code." }, { status: 400 });
    }

    await supabase
      .from("verification_otps")
      .update({ consumed_at: now })
      .eq("id", otpRow.id);
    verified = true;
  }

  if (!verified) {
    return NextResponse.json({ error: "Unable to verify phone." }, { status: 400 });
  }

  const adminClient = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const verifiedAt = new Date().toISOString();

  await adminClient.from("user_verifications").upsert({
    user_id: user.id,
    phone_e164: normalized,
    phone_verified_at: verifiedAt,
  }, { onConflict: "user_id" });

  if (hasServiceRoleEnv()) {
    await adminClient
      .from("profiles")
      .update({ phone_verified: true })
      .eq("id", user.id);
  }

  return NextResponse.json({ ok: true, verifiedAt });
}
