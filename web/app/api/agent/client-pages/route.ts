import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  buildClientSlug,
  normalizeClientPageCriteria,
  serializeClientPageCriteria,
} from "@/lib/agents/client-pages";
import { safeTrim } from "@/lib/agents/agent-storefront";
import { ensureAgentSlugForUser } from "@/lib/agents/agent-storefront.server";

const routeLabel = "/api/agent/client-pages";

const criteriaSchema = z.object({
  intent: z.enum(["rent", "buy"]).nullable(),
  city: z.string().max(120).nullable(),
  minPrice: z.number().int().nonnegative().nullable(),
  maxPrice: z.number().int().nonnegative().nullable(),
  bedrooms: z.number().int().nonnegative().nullable(),
  listingType: z.string().max(120).nullable(),
});

const createSchema = z.object({
  client_name: z.string().min(2).max(120),
  client_brief: z.string().max(400).optional().nullable(),
  title: z.string().max(160).optional().nullable(),
  criteria: z.record(z.any()).optional().default({}),
  pinned_property_ids: z.array(z.string().uuid()).optional().nullable(),
  published: z.boolean().optional(),
});

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("agent_client_pages")
    .select(
      "id, client_name, client_slug, client_brief, title, criteria, pinned_property_ids, published, updated_at"
    )
    .eq("agent_user_id", auth.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ pages: data ?? [] }, { status: 200 });
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  const payload = createSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const normalizedCriteria = normalizeClientPageCriteria(payload.data.criteria);
  const criteria = criteriaSchema.safeParse(normalizedCriteria);
  if (!criteria.success) {
    return NextResponse.json({ error: "Invalid criteria." }, { status: 400 });
  }

  const supabase = auth.supabase;
  let agentSlug = "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("agent_slug, display_name, full_name, business_name")
    .eq("id", auth.user.id)
    .maybeSingle();

  agentSlug = safeTrim(profile?.agent_slug);
  if (!agentSlug && hasServiceRoleEnv()) {
    const ensured = await ensureAgentSlugForUser({
      userId: auth.user.id,
      displayName: profile?.display_name,
    });
    agentSlug = safeTrim(ensured);
  }

  if (!agentSlug) {
    return NextResponse.json(
      { error: "Missing agent storefront slug. Update your profile first." },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("agent_client_pages")
    .select("client_slug")
    .eq("agent_user_id", auth.user.id);

  const existingSlugs = (existing ?? [])
    .map((row) => safeTrim(row.client_slug))
    .filter(Boolean);

  const clientSlug = buildClientSlug(payload.data.client_name, existingSlugs);

  let pinnedIds = (payload.data.pinned_property_ids ?? []).filter(Boolean);
  if (pinnedIds.length > 0) {
    const { data: pinnedRows } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", auth.user.id)
      .eq("status", "live")
      .in("id", pinnedIds);
    pinnedIds = (pinnedRows ?? []).map((row) => row.id as string);
  }

  const insertPayload = {
    agent_user_id: auth.user.id,
    agent_slug: agentSlug,
    client_slug: clientSlug,
    client_name: payload.data.client_name.trim(),
    client_brief: payload.data.client_brief?.trim() || null,
    title: payload.data.title?.trim() || null,
    criteria: serializeClientPageCriteria(criteria.data),
    pinned_property_ids: pinnedIds.length > 0 ? pinnedIds : null,
    published: payload.data.published ?? true,
  };

  const insertTable = supabase.from("agent_client_pages") as unknown as {
    insert: (values: typeof insertPayload) => {
      select: (columns: string) => {
        maybeSingle: () => Promise<{ data?: Record<string, unknown> | null; error?: { message?: string } | null }>;
      };
    };
  };

  const { data, error } = await insertTable
    .insert(insertPayload)
    .select(
      "id, client_name, client_slug, client_brief, title, criteria, pinned_property_ids, published, updated_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ page: data }, { status: 201 });
}
