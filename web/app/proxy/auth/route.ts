import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { UserRole } from "@/lib/types";

// Edge-friendly auth/role gate for protected paths, replacing the deprecated middleware pattern.

const DASHBOARD_ROLES: UserRole[] = ["landlord", "agent", "admin"];
const ADMIN_ROLES: UserRole[] = ["admin"];

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

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
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
    pathname.startsWith("/favourites");

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

  if (
    pathname.startsWith("/dashboard") &&
    !DASHBOARD_ROLES.includes(role ?? "tenant")
  ) {
    return buildRedirect(req, "/forbidden", "role");
  }

  return res;
}
