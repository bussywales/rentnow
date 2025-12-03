import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/ssr";
import type { UserRole } from "@/lib/types";

const DASHBOARD_ROLES: UserRole[] = ["landlord", "agent", "admin"];
const ADMIN_ROLES: UserRole[] = ["admin"];

function buildRedirect(req: NextRequest, target: string) {
  const url = req.nextUrl.clone();
  url.pathname = target;
  url.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;
  const requiresAuth =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/favourites");

  if (!requiresAuth) return res;

  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return buildRedirect(req, "/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  const role = profile?.role as UserRole | undefined;

  if (pathname.startsWith("/admin") && !ADMIN_ROLES.includes(role ?? "tenant")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (
    pathname.startsWith("/dashboard") &&
    !DASHBOARD_ROLES.includes(role ?? "tenant")
  ) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/favourites/:path*"],
};
