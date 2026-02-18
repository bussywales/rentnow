import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

async function getRequestCookies() {
  try {
    const store = cookies();
    return store instanceof Promise ? await store : store;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ ready: false, user: null, error: "missing env" });
  }

  try {
    const rawCookieHeader = request.headers.get("cookie");
    const supabase = await createServerSupabaseClient();
    const bootstrap = (supabase as unknown as { __bootstrap?: unknown }).__bootstrap;
    const cookieStore = await getRequestCookies();
    const cookieNames =
      cookieStore
        ?.getAll()
        .map((c) => c.name)
        .sort() ?? [];
    const cookieDetails =
      cookieStore
        ?.getAll()
        ?.map((c) => ({
          name: c.name,
          valueLength: c.value?.length ?? 0,
        })) ?? [];
    const headerCookieKeys = rawCookieHeader
      ?.split(";")
      .map((p) => p.split("=")[0]?.trim())
      .filter(Boolean)
      .sort() ?? [];

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    const errorMessage = error?.message || null;

    return NextResponse.json({
      ready: true,
      user,
      sessionUserId: user?.id ?? null,
      error: errorMessage,
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
