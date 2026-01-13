import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function proxy(request: NextRequest) {
  if (request.method === "POST" && request.nextUrl.pathname === "/auth/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login/submit";
    return NextResponse.rewrite(url);
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/|static/|favicon.ico|logo.svg).*)"],
};
