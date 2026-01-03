import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { validateUpgradeRequestAction } from "@/lib/billing/admin-validation";
import { logPlanOverride, logUpgradeRequestAction } from "@/lib/observability";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

const routeLabel = "/api/admin/upgrade-requests";

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  planTier: z.enum(["free", "starter", "pro", "tenant_pro"]).optional(),
  validUntil: z.string().datetime().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

export async function PATCH(request: Request) {
  const startTime = Date.now();

  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; upgrade requests unavailable." },
      { status: 503 }
    );
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const payload = schema.parse(await request.json());
  const action = payload.action;
  const note = payload.note?.trim() || null;
  const validation = validateUpgradeRequestAction({
    action,
    note,
    role: auth.role,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.error === "Forbidden" ? 403 : 400 });
  }

  const adminClient = createServiceRoleClient();
  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      upsert: (
        values: Record<string, unknown>,
        options?: { onConflict?: string }
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { data: requestRow, error: requestError } = await adminClient
    .from("plan_upgrade_requests")
    .select("id, profile_id, requester_id, requested_plan_tier")
    .eq("id", payload.id)
    .maybeSingle();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: requestError?.message || "Request not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const requestData = requestRow as {
    id: string;
    profile_id: string;
    requester_id: string;
    requested_plan_tier?: string | null;
  };
  const planTier = payload.planTier || requestData.requested_plan_tier || "starter";
  const validUntil = payload.validUntil ?? null;

  if (action === "approve") {
    const { error: planError } = await adminDb
      .from("profile_plans")
      .upsert(
        {
          profile_id: requestData.profile_id,
          plan_tier: planTier,
          valid_until: validUntil,
          billing_source: "manual",
          updated_at: now,
          updated_by: auth.user.id,
          upgraded_at: now,
          upgraded_by: auth.user.id,
        },
        { onConflict: "profile_id" }
      );

    if (planError) {
      return NextResponse.json({ error: planError.message }, { status: 400 });
    }

    if (note) {
      await adminDb
        .from("profile_billing_notes")
        .upsert(
          {
            profile_id: requestData.profile_id,
            billing_notes: note,
            updated_at: now,
            updated_by: auth.user.id,
          },
          { onConflict: "profile_id" }
        );
    }

    logPlanOverride({
      request,
      route: routeLabel,
      actorId: auth.user.id,
      profileId: requestRow.profile_id,
      planTier,
      maxListingsOverride: null,
      billingSource: "manual",
      validUntil,
    });
  }

  const { error: updateError } = await adminClient
    .from("plan_upgrade_requests")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      notes: note ?? requestData.requested_plan_tier ?? null,
      resolved_at: now,
      resolved_by: auth.user.id,
      updated_at: now,
    })
    .eq("id", payload.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  logUpgradeRequestAction({
    request,
    route: routeLabel,
    actorId: auth.user.id,
    requestId: requestData.id,
    profileId: requestData.profile_id,
    action,
    planTier: action === "approve" ? planTier : null,
    validUntil,
    noteProvided: !!note,
  });

  return NextResponse.json({ ok: true });
}
