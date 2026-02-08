import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/plans";

const payloadSchema = z.object({
  id: z.string().uuid(),
  listing_credits: z.number().int().min(0).max(1_000).optional(),
  featured_credits: z.number().int().min(0).max(1_000).optional(),
});

export async function PATCH(request: Request) {
  const startTime = Date.now();
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from("plans")
    .update({
      listing_credits: parsed.data.listing_credits,
      featured_credits: parsed.data.featured_credits,
      updated_at: now,
    })
    .eq("id", parsed.data.id)
    .select("id, role, tier, listing_credits, featured_credits, updated_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Unable to update plan." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, plan: data });
}
