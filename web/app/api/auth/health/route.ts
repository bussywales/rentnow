import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function jsonResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  if (!hasServerSupabaseEnv()) {
    return jsonResponse({ ok: false }, 401);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user: initialUser },
    } = await supabase.auth.getUser();

    let user = initialUser;
    if (!user) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed?.session) {
        const {
          data: { user: refreshedUser },
        } = await supabase.auth.getUser();
        user = refreshedUser;
      }
    }

    if (!user) {
      return jsonResponse({ ok: false }, 401);
    }

    let role: string | null = null;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      role = (profile?.role as string | null) ?? null;
    } catch {
      role = null;
    }

    return jsonResponse(
      {
        ok: true,
        userId: user.id,
        email: user.email ?? null,
        role,
      },
      200
    );
  } catch {
    return jsonResponse({ ok: false }, 401);
  }
}
