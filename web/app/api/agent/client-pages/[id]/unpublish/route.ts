import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { safeTrim } from "@/lib/agents/agent-storefront";

const routeLabel = "/api/agent/client-pages/[id]/unpublish";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  const resolvedParams = await params;
  const id = safeTrim(resolvedParams?.id);
  if (!id) {
    return NextResponse.json({ error: "Missing client page id." }, { status: 400 });
  }

  const { data: page } = await auth.supabase
    .from("agent_client_pages")
    .select("id, agent_user_id")
    .eq("id", id)
    .maybeSingle();

  if (!page) {
    return NextResponse.json({ error: "Client page not found." }, { status: 404 });
  }
  if (page.agent_user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("agent_client_pages")
    .update({
      published: false,
      unpublished_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
