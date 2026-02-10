import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/referrals/milestones/[id]";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    active_referrals_threshold: z.number().int().min(1).optional(),
    bonus_credits: z.number().int().min(1).optional(),
    is_enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

function normalizeMilestoneRow(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    name: String(row.name || "").trim(),
    active_referrals_threshold: Math.max(
      1,
      Math.trunc(Number(row.active_referrals_threshold || 0))
    ),
    bonus_credits: Math.max(1, Math.trunc(Number(row.bonus_credits || 0))),
    is_enabled: Boolean(row.is_enabled),
    created_at: String(row.created_at || ""),
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing milestone id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;

  if (parsed.data.active_referrals_threshold !== undefined) {
    const { data: duplicateThreshold } = await adminClient
      .from("referral_milestones")
      .select("id")
      .eq("active_referrals_threshold", parsed.data.active_referrals_threshold)
      .not("id", "eq", id)
      .maybeSingle();

    if (duplicateThreshold) {
      return NextResponse.json({ error: "Threshold must be unique." }, { status: 409 });
    }
  }

  const { data, error } = await adminClient
    .from("referral_milestones")
    .update(parsed.data)
    .eq("id", id)
    .select("id, name, active_referrals_threshold, bonus_credits, is_enabled, created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    milestone: normalizeMilestoneRow(data as Record<string, unknown>),
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing milestone id" }, { status: 400 });

  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
  const { error } = await adminClient.from("referral_milestones").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
