import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { fetchPublishedProductUpdateIds } from "@/lib/product-updates/product-updates.server";
import type { AdminUpdatesViewMode } from "@/lib/product-updates/audience";

export const dynamic = "force-dynamic";

const routeLabel = "/api/product-updates/read-all";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  try {
    const role = await getUserRole(auth.supabase, auth.user.id);
    const adminView =
      role === "admin"
        ? ((request.nextUrl.searchParams.get("adminView") as AdminUpdatesViewMode | null) ??
          undefined)
        : undefined;
    const updates = await fetchPublishedProductUpdateIds({
      client: auth.supabase,
      role,
      adminViewMode: adminView === "admin" ? "admin" : "all",
      limit: 200,
    });

    if (!updates.length) {
      return NextResponse.json({ count: 0 });
    }

    const rows = updates.map((update) => ({
      user_id: auth.user.id,
      update_id: update.id,
    }));

    const { error } = await auth.supabase
      .from("product_update_reads")
      .upsert(rows, { onConflict: "user_id,update_id" });

    if (error) {
      return NextResponse.json({ error: "Unable to mark updates as read" }, { status: 400 });
    }

    return NextResponse.json({ count: rows.length });
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: error instanceof Error ? error.message : "read all failed",
    });
    return NextResponse.json({ error: "Unable to mark updates as read" }, { status: 500 });
  }
}
