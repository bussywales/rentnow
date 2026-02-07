import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import {
  normalizeClientPageCriteria,
  serializeClientPageCriteria,
} from "@/lib/agents/client-pages";
import { safeTrim } from "@/lib/agents/agent-storefront";

const routeLabel = "/api/agent/client-pages/[id]";

const criteriaSchema = z.object({
  intent: z.enum(["rent", "buy"]).nullable(),
  city: z.string().max(120).nullable(),
  minPrice: z.number().int().nonnegative().nullable(),
  maxPrice: z.number().int().nonnegative().nullable(),
  bedrooms: z.number().int().nonnegative().nullable(),
  listingType: z.string().max(120).nullable(),
});

const updateSchema = z.object({
  client_name: z.string().min(2).max(120).optional(),
  client_brief: z.string().max(400).optional().nullable(),
  client_requirements: z.string().max(400).optional().nullable(),
  title: z.string().max(160).optional().nullable(),
  agent_about: z.string().max(400).optional().nullable(),
  agent_company_name: z.string().max(160).optional().nullable(),
  notes_md: z.string().max(1000).optional().nullable(),
  criteria: z.record(z.string(), z.any()).optional(),
  published: z.boolean().optional(),
  expires_at: z.string().datetime().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  const resolvedParams = await params;
  const id = safeTrim(resolvedParams?.id);
  if (!id) {
    return NextResponse.json({ error: "Missing client page id." }, { status: 400 });
  }

  const payload = updateSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const supabase = auth.supabase;

  const { data: existing } = await supabase
    .from("agent_client_pages")
    .select("id, agent_user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Client page not found." }, { status: 404 });
  }
  if (existing.agent_user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (payload.data.client_name !== undefined) {
    updates.client_name = payload.data.client_name.trim();
  }
  if (payload.data.client_brief !== undefined) {
    updates.client_brief = payload.data.client_brief?.trim() || null;
  }
  if (payload.data.client_requirements !== undefined) {
    updates.client_requirements = payload.data.client_requirements?.trim() || null;
  }
  if (payload.data.title !== undefined) {
    updates.title = payload.data.title?.trim() || null;
  }
  if (payload.data.agent_about !== undefined) {
    updates.agent_about = payload.data.agent_about?.trim() || null;
  }
  if (payload.data.agent_company_name !== undefined) {
    updates.agent_company_name = payload.data.agent_company_name?.trim() || null;
  }
  if (payload.data.notes_md !== undefined) {
    updates.notes_md = payload.data.notes_md?.trim() || null;
  }
  if (payload.data.criteria !== undefined) {
    const normalizedCriteria = normalizeClientPageCriteria(payload.data.criteria);
    const criteria = criteriaSchema.safeParse(normalizedCriteria);
    if (!criteria.success) {
      return NextResponse.json({ error: "Invalid criteria." }, { status: 400 });
    }
    updates.criteria = serializeClientPageCriteria(criteria.data);
  }
  if (payload.data.expires_at !== undefined) {
    updates.expires_at = payload.data.expires_at;
  }
  if (payload.data.published !== undefined) {
    updates.published = payload.data.published;
    updates.published_at = payload.data.published ? new Date().toISOString() : null;
    updates.unpublished_at = payload.data.published ? null : new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  const updateTable = supabase.from("agent_client_pages") as unknown as {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        select: (columns: string) => {
          maybeSingle: () => Promise<{ data?: Record<string, unknown> | null; error?: { message?: string } | null }>;
        };
      };
    };
  };

  const { data, error } = await updateTable
    .update(updates)
    .eq("id", id)
    .select(
      "id, client_name, client_slug, client_brief, client_requirements, title, agent_about, agent_company_name, agent_logo_url, banner_url, notes_md, criteria, pinned_property_ids, published, published_at, expires_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ page: data }, { status: 200 });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  const resolvedParams = await params;
  const id = safeTrim(resolvedParams?.id);
  if (!id) {
    return NextResponse.json({ error: "Missing client page id." }, { status: 400 });
  }

  const supabase = auth.supabase;
  const { data: existing } = await supabase
    .from("agent_client_pages")
    .select("id, agent_user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Client page not found." }, { status: 404 });
  }
  if (existing.agent_user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const deleteTable = supabase.from("agent_client_pages") as unknown as {
    delete: () => { eq: (column: string, value: string) => Promise<{ error?: { message?: string } | null }> };
  };

  const { error } = await deleteTable.delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
