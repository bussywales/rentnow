import { NextResponse } from "next/server";
import { getReferralCookieName } from "@/lib/referrals/cookie";

const CODE_REGEX = /^[A-Z0-9_-]{4,32}$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const params = await context.params;
  const code = (params.code || "").trim().toUpperCase();
  const redirectUrl = new URL(`/auth/register?ref=${encodeURIComponent(code)}`, request.url);

  const response = NextResponse.redirect(redirectUrl, 307);

  if (!CODE_REGEX.test(code)) {
    return response;
  }

  response.cookies.set({
    name: getReferralCookieName(),
    value: code,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
