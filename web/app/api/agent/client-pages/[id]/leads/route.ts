import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { safeTrim } from "@/lib/agents/agent-storefront";
import { canAccessClientPageInbox } from "@/lib/agents/client-page-inbox";
import { fetchClientPageLeads } from "@/lib/agents/client-page-inbox.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/agent/client-pages/[id]/leads";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  const resolvedParams = await params;
  const clientPageId = safeTrim(resolvedParams?.id);
  if (!clientPageId) {
    return NextResponse.json({ error: "Missing client page id." }, { status: 400 });
  }

  const supabase = auth.supabase;
  const { data: page } = await supabase
    .from("agent_client_pages")
    .select("id, agent_user_id, client_name, client_requirements, client_slug")
    .eq("id", clientPageId)
    .maybeSingle();

  if (!page || !canAccessClientPageInbox({ viewerId: auth.user.id, clientPageOwnerId: page.agent_user_id })) {
    return NextResponse.json({ error: "Client page not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const statusParam = safeTrim(url.searchParams.get("status")) || "all";
  const dateRange = safeTrim(url.searchParams.get("date")) || "all";
  const propertyId = safeTrim(url.searchParams.get("property"));
  const unreadOnly = url.searchParams.get("unread") === "true";
  const pageParam = Number.parseInt(url.searchParams.get("page") || "0", 10);
  const pageSizeParam = Number.parseInt(url.searchParams.get("pageSize") || "20", 10);
  const normalizedStatusMap: Record<
    string,
    "all" | "offer" | "NEW" | "CONTACTED" | "VIEWING" | "WON" | "LOST"
  > = {
    all: "all",
    offer: "offer",
    new: "NEW",
    contacted: "CONTACTED",
    viewing: "VIEWING",
    won: "WON",
    lost: "LOST",
  };
  const normalizedStatus = normalizedStatusMap[statusParam.toLowerCase()] ?? "all";

  const result = await fetchClientPageLeads({
    supabase,
    clientPageId,
    filters: {
      status: normalizedStatus,
      dateRange: dateRange as "all" | "today" | "week" | "month",
      propertyId: propertyId || null,
      unreadOnly,
      page: Number.isFinite(pageParam) ? pageParam : 0,
      pageSize: Number.isFinite(pageSizeParam) ? pageSizeParam : 20,
    },
    includeBuyerEmail: true,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    leads: result.leads,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    clientPage: {
      id: page.id,
      name: page.client_name ?? null,
      requirements: page.client_requirements ?? null,
      slug: page.client_slug ?? null,
    },
  });
}
