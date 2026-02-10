import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/referrals/milestones";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  active_referrals_threshold: z.number().int().min(1),
  bonus_credits: z.number().int().min(1),
  is_enabled: z.boolean().optional(),
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

async function listMilestones(adminClient: UntypedAdminClient) {
  const { data, error } = await adminClient
    .from("referral_milestones")
    .select("id, name, active_referrals_threshold, bonus_credits, is_enabled, created_at")
    .order("active_referrals_threshold", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return { error: error.message, milestones: [] };
  return {
    error: null,
    milestones: ((data as Record<string, unknown>[] | null) ?? [])
      .map(normalizeMilestoneRow)
      .sort((a, b) => a.active_referrals_threshold - b.active_referrals_threshold),
  };
}

export async function GET(request: NextRequest) {
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

  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
  const result = await listMilestones(adminClient);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ milestones: result.milestones });
}

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;

  const { data: duplicateThreshold } = await adminClient
    .from("referral_milestones")
    .select("id")
    .eq("active_referrals_threshold", parsed.data.active_referrals_threshold)
    .maybeSingle();

  if (duplicateThreshold) {
    return NextResponse.json({ error: "Threshold must be unique." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from("referral_milestones")
    .insert({
      name: parsed.data.name,
      active_referrals_threshold: parsed.data.active_referrals_threshold,
      bonus_credits: parsed.data.bonus_credits,
      is_enabled: parsed.data.is_enabled ?? true,
      created_at: now,
    })
    .select("id, name, active_referrals_threshold, bonus_credits, is_enabled, created_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Unable to create milestone" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    milestone: normalizeMilestoneRow(data as Record<string, unknown>),
  });
}
