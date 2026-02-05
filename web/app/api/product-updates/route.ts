import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { buildProductUpdatesFeed } from "@/lib/product-updates/product-updates.server";
import type { AdminUpdatesViewMode } from "@/lib/product-updates/audience";

export const dynamic = "force-dynamic";

const routeLabel = "/api/product-updates";

export async function GET(request: NextRequest) {
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
    const updates = await buildProductUpdatesFeed({
      client: auth.supabase,
      role,
      userId: auth.user.id,
      adminViewMode: adminView === "admin" ? "admin" : "all",
      limit: 50,
    });

    return NextResponse.json({ updates });
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: error instanceof Error ? error.message : "product updates fetch failed",
    });
    return NextResponse.json({ error: "Unable to load updates" }, { status: 500 });
  }
}
