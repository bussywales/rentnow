import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/leads/tags";

export async function GET(request: Request) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("lead_tags")
    .select("tag")
    .order("tag", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const unique = Array.from(new Set((data ?? []).map((row) => row.tag)));
  return NextResponse.json({ tags: unique });
}
