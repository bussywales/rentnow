import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveWwwCanonicalRedirect } from "@/lib/routing/canonical-host";

export function proxy(request: NextRequest) {
  const canonicalUrl = resolveWwwCanonicalRedirect(request.nextUrl, process.env.NODE_ENV);
  if (canonicalUrl) {
    return NextResponse.redirect(canonicalUrl, 308);
  }

  if (request.method === "POST" && request.nextUrl.pathname === "/auth/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login/submit";
    return NextResponse.rewrite(url);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/|static/|favicon.ico|logo.svg|assets/|images/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$).*)",
  ],
};
