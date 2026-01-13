import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  logSuppressedAuthCookieClear,
  shouldSuppressAuthCookieClear,
  shouldLogCookieDebug,
} from "@/lib/auth/cookie-guard";
import { selectAuthCookieValueFromHeader } from "@/lib/auth/cookie-parser";
import type { UserRole } from "@/lib/types";

// Edge-friendly auth/role gate for protected paths, replacing the deprecated middleware pattern.

const DASHBOARD_ROLES: UserRole[] = ["landlord", "agent", "admin"];
const ADMIN_ROLES: UserRole[] = ["admin"];
const TENANT_DASHBOARD_ALLOWLIST = [
  "/dashboard",
  "/dashboard/saved-searches",
  "/dashboard/messages",
  "/dashboard/viewings",
  "/dashboard/billing",
];

function buildRedirect(req: NextRequest, target: string, reason?: string) {
  const url = req.nextUrl.clone();
  url.pathname = target;
  url.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

function getSupabase(req: NextRequest, res: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const debug = shouldLogCookieDebug(
    req.nextUrl.searchParams.get("debug") === "1"
  );

  return createServerClient(supabaseUrl, supabaseKey, {
    cookieEncoding: "base64url",
    cookies: {
      get(name: string) {
        if (name.includes("auth-token")) {
          const selected = selectAuthCookieValueFromHeader(
            req.headers.get("cookie"),
            name
          );
          if (selected) return selected;
        }
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        if (shouldSuppressAuthCookieClear(name, options, value)) {
          logSuppressedAuthCookieClear({
            route: req.nextUrl.pathname,
            cookieName: name,
            source: "proxy-auth-set",
            debug,
          });
          return;
        }
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        if (shouldSuppressAuthCookieClear(name, options, "")) {
          logSuppressedAuthCookieClear({
            route: req.nextUrl.pathname,
            cookieName: name,
            source: "proxy-auth-remove",
            debug,
          });
          return;
        }
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });
}

export async function GET(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.searchParams.get("path") || "/";
  const requiresAuth =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/favourites") ||
    pathname.startsWith("/tenant") ||
    pathname.startsWith("/host");

  if (!requiresAuth) return res;

  const supabase = getSupabase(req, res);
  if (!supabase) return res; // Demo mode: allow through.

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return buildRedirect(req, "/auth/required", "auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  const role = profile?.role as UserRole | undefined;

  if (pathname.startsWith("/admin") && !ADMIN_ROLES.includes(role ?? "tenant")) {
    return buildRedirect(req, "/forbidden", "role");
  }

  if (pathname.startsWith("/tenant")) {
    if (role !== "tenant") {
      const target = role === "admin" ? "/admin/support" : "/host";
      return buildRedirect(req, target, "role");
    }
    return res;
  }

  if (pathname.startsWith("/host")) {
    if (role === "tenant") {
      return buildRedirect(req, "/tenant", "role");
    }
    if (role === "admin") {
      return buildRedirect(req, "/admin/support", "role");
    }
    return res;
  }

  if (pathname.startsWith("/dashboard")) {
    if (role === "tenant") {
      const allowed = TENANT_DASHBOARD_ALLOWLIST.some(
        (allowedPath) =>
          pathname === allowedPath || pathname.startsWith(`${allowedPath}/`)
      );
      if (!allowed) {
        return buildRedirect(req, "/tenant", "role");
      }
      return res;
    }
    if (!DASHBOARD_ROLES.includes(role ?? "tenant")) {
      return buildRedirect(req, "/forbidden", "role");
    }
  }

  return res;
}
