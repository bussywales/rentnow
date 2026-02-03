import { NextResponse } from "next/server";
import { ensureSessionCookie } from "@/lib/analytics/session.server";

export async function GET(request: Request) {
  const response = NextResponse.json({ ok: true });
  ensureSessionCookie(request, response);
  return response;
}
