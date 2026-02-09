import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { normalizePolicyCountryCode } from "@/lib/referrals/cashout";

const routeLabel = "/api/admin/referrals/policies/[id]";

const patchSchema = z
  .object({
    country_code: z.string().min(2).max(3).optional(),
    payouts_enabled: z.boolean().optional(),
    conversion_enabled: z.boolean().optional(),
    credit_to_cash_rate: z.number().min(0).optional(),
    currency: z.string().min(1).max(10).optional(),
    min_cashout_credits: z.number().int().min(0).optional(),
    monthly_cashout_cap_amount: z.number().min(0).optional(),
    requires_manual_approval: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

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
  if (!id) return NextResponse.json({ error: "Missing policy id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const payload = parsed.data;
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.country_code !== undefined) {
    update.country_code = normalizePolicyCountryCode(payload.country_code);
  }
  if (payload.payouts_enabled !== undefined) update.payouts_enabled = payload.payouts_enabled;
  if (payload.conversion_enabled !== undefined) update.conversion_enabled = payload.conversion_enabled;
  if (payload.credit_to_cash_rate !== undefined) update.credit_to_cash_rate = payload.credit_to_cash_rate;
  if (payload.currency !== undefined) update.currency = payload.currency.trim().toUpperCase();
  if (payload.min_cashout_credits !== undefined) update.min_cashout_credits = payload.min_cashout_credits;
  if (payload.monthly_cashout_cap_amount !== undefined) {
    update.monthly_cashout_cap_amount = payload.monthly_cashout_cap_amount;
  }
  if (payload.requires_manual_approval !== undefined) {
    update.requires_manual_approval = payload.requires_manual_approval;
  }

  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
  const { data, error } = await adminClient
    .from("referral_jurisdiction_policies")
    .update(update)
    .eq("id", id)
    .select(
      "id, country_code, payouts_enabled, conversion_enabled, credit_to_cash_rate, currency, min_cashout_credits, monthly_cashout_cap_amount, requires_manual_approval, updated_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, policy: data });
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
  if (!id) return NextResponse.json({ error: "Missing policy id" }, { status: 400 });

  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
  const { error } = await adminClient
    .from("referral_jurisdiction_policies")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
