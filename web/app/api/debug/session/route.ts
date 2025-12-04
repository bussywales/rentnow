import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export async function GET() {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ ready: false, user: null, error: "missing env" });
  }

  try {
    const supabase = createServerSupabaseClient();
    const bootstrap = (supabase as unknown as { __bootstrap?: unknown }).__bootstrap;
    const cookieNames = await (async () => {
      try {
        // List cookie names only (no values) to confirm visibility on the server.
        const store = await cookies();
        return store
          .getAll()
          .map((c) => c.name)
          .sort();
      } catch {
        return [];
      }
    })();

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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ready: true, user: null, error: message });
  }
}
