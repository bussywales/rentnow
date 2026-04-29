import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/debug/session";

type SessionDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  authorizeAdmin: typeof requireRole;
  getRequestCookies: typeof getRequestCookies;
};

async function getRequestCookies() {
  try {
    const store = cookies();
    return store instanceof Promise ? await store : store;
  } catch {
    return null;
  }
}

const defaultDeps: SessionDeps = {
  hasServerSupabaseEnv,
  authorizeAdmin: requireRole,
  getRequestCookies,
};

export async function getDebugSessionResponse(
  request: Request,
  deps: SessionDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ ready: false, user: null, error: "missing env" }, { status: 503 });
  }

  const auth = await deps.authorizeAdmin({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  try {
    const rawCookieHeader = request.headers.get("cookie");
    const bootstrap = (auth.supabase as unknown as { __bootstrap?: unknown }).__bootstrap;
    const cookieStore = await deps.getRequestCookies();
    const cookieNames =
      cookieStore
        ?.getAll()
        .map((cookie) => cookie.name)
        .sort() ?? [];
    const cookieDetails =
      cookieStore?.getAll().map((cookie) => ({
        name: cookie.name,
        valueLength: cookie.value?.length ?? 0,
      })) ?? [];
    const headerCookieKeys =
      rawCookieHeader
        ?.split(";")
        .map((part) => part.split("=")[0]?.trim())
        .filter(Boolean)
        .sort() ?? [];

    const {
      data: { user },
      error,
    } = await auth.supabase.auth.getUser();

    return NextResponse.json({
      ready: true,
      user,
      sessionUserId: user?.id ?? null,
      error: error?.message || null,
      bootstrap,
      cookieNames,
      cookieDetails,
      headerCookieKeys,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ready: true, user: null, error: message });
  }
}

export async function GET(request: Request) {
  return getDebugSessionResponse(request, defaultDeps);
}
