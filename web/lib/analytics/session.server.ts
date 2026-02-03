import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";

export const SESSION_COOKIE_NAME = "ph_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const parts = header.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    const raw = part.slice(name.length + 1);
    return raw ? decodeURIComponent(raw) : null;
  }
  return null;
}

export function hashSessionKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function getSessionKeyFromCookies(): string | null {
  const value = cookies().get(SESSION_COOKIE_NAME)?.value;
  return value ? hashSessionKey(value) : null;
}

export function getSessionKeyFromRequest(request: Request): string | null {
  const raw = parseCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (raw) return hashSessionKey(raw);

  const forwardedFor = request.headers.get("x-forwarded-for");
  const userAgent = request.headers.get("user-agent");
  const ip = forwardedFor?.split(",")[0]?.trim();
  if (ip || userAgent) {
    const fingerprint = `${ip ?? "unknown"}|${userAgent ?? "unknown"}`;
    return hashSessionKey(fingerprint);
  }

  return null;
}

export function getSessionKeyFromUser(userId?: string | null): string | null {
  if (!userId) return null;
  return hashSessionKey(userId);
}

export function ensureSessionCookie(request: Request, response: NextResponse): string {
  const existing = parseCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (existing) return hashSessionKey(existing);
  const raw = randomUUID();
  response.cookies.set(SESSION_COOKIE_NAME, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return hashSessionKey(raw);
}
