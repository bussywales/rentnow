import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { normalizeE164 } from "@/lib/verification/phone";
import { generateOtpCode, hashOtp } from "@/lib/verification/otp";
import { getSiteUrl } from "@/lib/env";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

type RateLimitState = { count: number; resetAt: number };
const globalStore = globalThis as typeof globalThis & {
  __verificationOtpRateLimit?: Map<string, RateLimitState>;
};

function getRateLimiter() {
  if (!globalStore.__verificationOtpRateLimit) {
    globalStore.__verificationOtpRateLimit = new Map();
  }
  return globalStore.__verificationOtpRateLimit;
}

function checkRateLimit(userId: string) {
  const limiter = getRateLimiter();
  const now = Date.now();
  const state = limiter.get(userId);
  if (!state || now >= state.resetAt) {
    limiter.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (state.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSeconds: Math.ceil((state.resetAt - now) / 1000) };
  }
  state.count += 1;
  limiter.set(userId, state);
  return { allowed: true, retryAfterSeconds: 0 };
}

const payloadSchema = z.object({
  phoneE164: z.string().min(1),
});

function getAnonClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function sendOtpEmail(input: { to: string; code: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    console.warn("[verification] Resend not configured; OTP code:", input.code);
    return { ok: false, error: "Email not configured" };
  }

  const siteUrl = await getSiteUrl();
  const subject = "Your RentNow verification code";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <h2 style="margin: 0 0 8px;">Verify your phone</h2>
      <p style="margin: 0 0 12px;">Your verification code is:</p>
      <div style="font-size: 20px; font-weight: bold; letter-spacing: 2px;">${input.code}</div>
      <p style="margin: 12px 0 0;">If you didn’t request this, you can ignore this email.</p>
      <p style="margin: 12px 0 0; color: #64748b;">RentNow • ${siteUrl}</p>
    </div>
  `;

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: input.to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: body || res.statusText };
  }

  return { ok: true };
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
    return NextResponse.json({ error: "Invalid phone format. Use +<country code>." }, { status: 400 });
  }

  const rateLimit = checkRateLimit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many attempts. Please wait before requesting another code.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  const anonClient = getAnonClient();
  if (anonClient) {
    const { error } = await anonClient.auth.signInWithOtp({
      phone: normalized,
      options: { shouldCreateUser: false },
    });
    if (!error) {
      return NextResponse.json({ ok: true, mode: "supabase_phone_otp" });
    }
  }

  const code = generateOtpCode();
  const hashed = hashOtp(code, user.id, normalized);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from("verification_otps").insert({
    user_id: user.id,
    kind: "phone_email_fallback",
    target: normalized,
    code_hash: hashed,
    expires_at: expiresAt,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const email = user.email ?? "";
  if (!email) {
    return NextResponse.json({ error: "Email missing for fallback delivery." }, { status: 400 });
  }

  const delivery = await sendOtpEmail({ to: email, code });

  return NextResponse.json({
    ok: true,
    mode: "email_fallback",
    delivery: delivery.ok ? "sent" : "log",
  });
}
