import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { ensureSessionCookie } from "@/lib/analytics/session.server";
import { productAnalyticsClientPayloadSchema } from "@/lib/analytics/product-events";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";
import { normalizeRole } from "@/lib/roles";

const routeLabel = "/api/analytics/product";

export async function POST(request: Request) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = productAnalyticsClientPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid analytics payload" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let userRole: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    userRole = normalizeRole(profile?.role) ?? null;
  }

  const response = NextResponse.json({ ok: true });
  ensureSessionCookie(request, response);

  const result = await logProductAnalyticsEvent({
    eventName: parsed.data.eventName,
    properties: parsed.data.properties,
    request,
    supabase,
    userId: user?.id ?? null,
    userRole,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: "analytics_insert_failed", route: routeLabel },
      { status: 500 }
    );
  }

  return response;
}
