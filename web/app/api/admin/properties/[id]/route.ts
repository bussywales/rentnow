import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { getPlanUsage } from "@/lib/plan-enforcement";
import { dispatchSavedSearchAlerts } from "@/lib/alerts/tenant-alerts";
import { logApprovalAction, logFailure, logPlanLimitHit } from "@/lib/observability";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

const routeLabel = "/api/admin/properties/[id]";

export const bodySchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "reject") {
      const trimmed = (value.reason || "").trim();
      if (!trimmed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reason"],
          message: "Rejection reason is required",
        });
      }
    }
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await context.params;
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const body = await request.json();
  const { action, reason } = bodySchema.parse(body);
  const isApproved = action === "approve";
  const now = new Date().toISOString();
  const trimmedReason = typeof reason === "string" ? reason.trim() : "";

  if (!isApproved && !trimmedReason) {
    return NextResponse.json({ error: "Rejection reason is required." }, { status: 400 });
  }

  const adminClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
  const lookupClient = adminClient ?? supabase;
  const { data: existing, error: fetchError } = await lookupClient
    .from("properties")
    .select("owner_id, is_active")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: fetchError || "Property not found",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const willActivate = isApproved && !existing.is_active;
  if (willActivate) {
    const usage = await getPlanUsage({
      supabase,
      ownerId: existing.owner_id,
      serviceClient: adminClient,
      excludeId: id,
    });
    if (usage.error) {
      logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        error: new Error(usage.error),
      });
      return NextResponse.json({ error: usage.error }, { status: 500 });
    }
    if (usage.activeCount >= usage.plan.maxListings) {
      logPlanLimitHit({
        request,
        route: routeLabel,
        actorId: auth.user.id,
        ownerId: existing.owner_id,
        propertyId: id,
        planTier: usage.plan.tier,
        maxListings: usage.plan.maxListings,
        activeCount: usage.activeCount,
        source: usage.source,
      });
      return NextResponse.json(
        {
          error: "Plan limit reached",
          code: "plan_limit_reached",
          maxListings: usage.plan.maxListings,
          activeCount: usage.activeCount,
          planTier: usage.plan.tier,
        },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from("properties")
    .update(
      isApproved
        ? {
            status: "live",
            is_approved: true,
            is_active: true,
            approved_at: now,
            rejection_reason: null,
            rejected_at: null,
          }
        : {
            status: "rejected",
            is_approved: false,
            is_active: false,
            rejected_at: now,
            rejection_reason: trimmedReason,
          }
    )
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    await supabase.from("admin_actions_log").insert({
      property_id: id,
      action_type: action,
      actor_id: auth.user.id,
      payload_json: action === "reject" ? { reason: trimmedReason } : { status: "live" },
    });
  } catch {
    /* ignore logging failures */
  }

  logApprovalAction({
    request,
    route: routeLabel,
    actorId: auth.user.id,
    propertyId: id,
    action,
    reasonProvided: !isApproved,
  });

  if (isApproved) {
    try {
      const alertResult = await dispatchSavedSearchAlerts(id);
      if (!alertResult.ok) {
        logFailure({
          request,
          route: routeLabel,
          status: alertResult.status ?? 500,
          startTime,
          error: new Error(alertResult.error ?? "Alert dispatch failed"),
        });
      }
    } catch (err) {
      logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        error: err,
      });
    }
  }

  return NextResponse.json({ id, is_approved: isApproved });
}
