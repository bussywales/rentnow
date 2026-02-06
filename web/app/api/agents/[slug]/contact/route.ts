import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getAgentStorefrontData } from "@/lib/agents/agent-storefront.server";
import { safeTrim } from "@/lib/agents/agent-storefront";
import {
  agentLeadPayloadSchema,
  getRateLimitWindowStart,
  isHoneypotTriggered,
} from "@/lib/agents/agent-leads";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX = 3;

function getRequestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return request.headers.get("x-real-ip") || null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const resolvedParams = await params;
  const slug = safeTrim(resolvedParams?.slug);
  if (!slug) {
    return NextResponse.json({ error: "Missing agent slug." }, { status: 400 });
  }

  const payload = agentLeadPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  // Honeypot: if filled, silently accept.
  if (isHoneypotTriggered(payload.data)) {
    return NextResponse.json({ ok: true });
  }

  const storefront = await getAgentStorefrontData(slug, {
    requestId: `contact-${Date.now()}`,
  });
  if (!storefront.ok || !storefront.storefront) {
    return NextResponse.json({ error: "Agent storefront unavailable." }, { status: 404 });
  }

  const ipAddress = getRequestIp(request);
  const now = new Date();
  const windowStart = getRateLimitWindowStart(now, RATE_LIMIT_WINDOW_MINUTES);

  const supabase = createServiceRoleClient();
  if (ipAddress) {
    const { count } = await supabase
      .from("agent_leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ipAddress)
      .gte("created_at", windowStart);

    if (typeof count === "number" && count >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429 }
      );
    }
  }

  const insertPayload = {
    agent_user_id: storefront.storefront.agent.id,
    agent_slug: storefront.storefront.agent.slug ?? slug,
    status: "NEW",
    name: payload.data.name.trim(),
    email: payload.data.email.trim(),
    phone: safeTrim(payload.data.phone) || null,
    message: payload.data.message.trim(),
    source: "agent_storefront",
    source_url: request.headers.get("referer") || null,
    ip_address: ipAddress,
    user_agent: request.headers.get("user-agent") || null,
  };

  // Supabase types don't yet include agent_leads in this repo.
  const leadsTable = supabase.from("agent_leads") as unknown as {
    insert: (
      values: typeof insertPayload
    ) => Promise<{ error: { message?: string } | null }>;
  };

  const { error } = await leadsTable.insert(insertPayload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
