import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ ready: false, user: null, error: "missing env" });
  }

  try {
    const rawCookieHeader = request.headers.get("cookie");
    const supabase = await createServerSupabaseClient(rawCookieHeader);
    const bootstrap = (supabase as unknown as { __bootstrap?: unknown }).__bootstrap;
    const cookieNames = (() => {
      try {
        // List cookie names only (no values) to confirm visibility on the server.
        const maybeStore = cookies();
        const maybeThen = (maybeStore as unknown as { then?: unknown })?.then;
        const store =
          typeof maybeThen === "function"
            ? null
            : (maybeStore as unknown as { getAll: () => { name: string }[] });
        return (
          store
            ?.getAll()
            ?.map((c) => c.name)
            ?.sort() ?? []
        );
      } catch {
        return [];
      }
    })();
    const cookieDetails = (() => {
      try {
        const maybeStore = cookies();
        const maybeThen = (maybeStore as unknown as { then?: unknown })?.then;
        const store =
          typeof maybeThen === "function"
            ? null
            : (maybeStore as unknown as {
                getAll: () => { name: string; value?: string | null }[];
              });
        return (
          store
            ?.getAll()
            ?.map((c) => ({
              name: c.name,
              valueLength: c.value?.length ?? 0,
            })) ?? []
        );
      } catch {
        return [];
      }
    })();
    const headerCookieKeys = rawCookieHeader
      ?.split(";")
      .map((p) => p.split("=")[0]?.trim())
      .filter(Boolean)
      .sort() ?? [];

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    const errorMessage = error?.message || sessionError?.message || null;

    return NextResponse.json({
      ready: true,
      user,
      sessionUserId: session?.user?.id ?? null,
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
