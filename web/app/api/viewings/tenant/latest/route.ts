import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/viewings/tenant/latest";

const querySchema = z.object({
  propertyId: z.string().uuid(),
});

export async function GET(request: Request) {
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    propertyId: url.searchParams.get("propertyId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid propertyId" }, { status: 400 });
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant"],
  });
  if (!auth.ok) return auth.response;

  try {
    const { data, error } = await auth.supabase
      .from("viewing_requests")
      .select("id, status, created_at, decided_at, no_show_reported_at")
      .eq("tenant_id", auth.user.id)
      .eq("property_id", parsed.data.propertyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(error.message),
      });
      return NextResponse.json({ error: "Unable to load viewing requests" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, latest: data || null });
  } catch (err) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json({ error: "Unable to load viewing requests" }, { status: 500 });
  }
}
