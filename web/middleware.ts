import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Force a single canonical host to prevent duplicate auth cookies between rentnow.space and www.rentnow.space.
export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";

  // Skip for localhost and Vercel preview hosts.
  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");
  const isPreview = host.includes(".vercel.app");
  if (isLocal || isPreview) return NextResponse.next();

  // Enforce www.rentnow.space as canonical.
  if (host === "rentnow.space") {
    const url = req.nextUrl.clone();
    url.host = "www.rentnow.space";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply to all routes except Next internals and static files.
    "/((?!_next/|api/|static/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2)).*)",
  ],
};
