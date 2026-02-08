import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { safeTrim } from "@/lib/agents/agent-storefront";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";

const routeLabel = "/api/agent/client-pages/[id]/external-listings/[listingId]";

type RouteContext = { params: Promise<{ id?: string; listingId?: string }> };

type PageRow = { id: string; agent_user_id: string };

async function ensureOwnership(supabase: any, pageId: string, userId: string) {
  const { data } = await supabase
    .from("agent_client_pages")
    .select("id, agent_user_id")
    .eq("id", pageId)
    .maybeSingle();
  if (!data) return { ok: false, status: 404, error: "Client page not found." };
  if (data.agent_user_id !== userId) return { ok: false, status: 403, error: "Forbidden." };
  return { ok: true, page: data as PageRow };
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  const networkEnabled = await getAppSettingBool(
    APP_SETTING_KEYS.agentNetworkDiscoveryEnabled,
    false
  );
  if (!networkEnabled) {
    return NextResponse.json(
      { error: "Agent network discovery is disabled." },
      { status: 403 }
    );
  }

  const resolvedParams = await params;
  const pageId = safeTrim(resolvedParams?.id);
  const listingId = safeTrim(resolvedParams?.listingId);
  if (!pageId || !listingId) {
    return NextResponse.json({ error: "Missing client page or listing id." }, { status: 400 });
  }

  const ownership = await ensureOwnership(auth.supabase, pageId, auth.user.id);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  await auth.supabase
    .from("agent_client_page_listings")
    .delete()
    .eq("client_page_id", pageId)
    .eq("property_id", listingId);

  await auth.supabase
    .from("agent_listing_shares")
    .delete()
    .eq("client_page_id", pageId)
    .eq("listing_id", listingId)
    .eq("presenting_user_id", auth.user.id);

  return NextResponse.json({ ok: true });
}
