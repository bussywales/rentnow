import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { countUnreadUpdates } from "@/lib/product-updates/audience";
import {
  fetchProductUpdateReadIds,
  fetchPublishedProductUpdateIds,
} from "@/lib/product-updates/product-updates.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/product-updates/unread-count";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  try {
    const role = await getUserRole(auth.supabase, auth.user.id);
    const updates = await fetchPublishedProductUpdateIds({
      client: auth.supabase,
      role,
      limit: 200,
    });
    const readIds = await fetchProductUpdateReadIds({
      client: auth.supabase,
      userId: auth.user.id,
      updateIds: updates.map((update) => update.id),
    });

    const unreadCount = countUnreadUpdates(
      updates.map((update) => ({ id: update.id })),
      Array.from(readIds).map((id) => ({ update_id: id }))
    );

    return NextResponse.json({ unreadCount });
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: error instanceof Error ? error.message : "unread count fetch failed",
    });
    return NextResponse.json({ error: "Unable to load unread count" }, { status: 500 });
  }
}
