import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { resolveTierForRole } from "@/lib/billing/provider-payments";
import {
  finalizePaystackSubscriptionEvent,
  getPaystackSubscriptionEventByReference,
} from "@/lib/billing/paystack-subscriptions.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { logFailure, logProviderPlanUpdated, logProviderVerifyOutcome } from "@/lib/observability";
import { type PlanTier } from "@/lib/plans";

const routeLabel = "/api/billing/paystack/verify";

const payloadSchema = z.object({
  reference: z.string().min(8),
});

export type PaystackVerifyRouteDeps = {
  requireRole: typeof requireRole;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getPaystackSubscriptionEventByReference: typeof getPaystackSubscriptionEventByReference;
  finalizePaystackSubscriptionEvent: typeof finalizePaystackSubscriptionEvent;
  resolveTierForRole: typeof resolveTierForRole;
  logProviderPlanUpdated: typeof logProviderPlanUpdated;
  logProviderVerifyOutcome: typeof logProviderVerifyOutcome;
  logFailure: typeof logFailure;
};

const defaultDeps: PaystackVerifyRouteDeps = {
  requireRole,
  hasServiceRoleEnv,
  createServiceRoleClient,
  getPaystackSubscriptionEventByReference,
  finalizePaystackSubscriptionEvent,
  resolveTierForRole,
  logProviderPlanUpdated,
  logProviderVerifyOutcome,
  logFailure,
};

export async function postPaystackVerifyResponse(
  request: Request,
  deps: PaystackVerifyRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "tenant", "admin"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; Paystack verification unavailable." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const reference = parsed.data.reference;
  const adminClient = deps.createServiceRoleClient();
  const adminDb = adminClient as unknown as UntypedAdminClient;

  const event = await deps.getPaystackSubscriptionEventByReference({
    adminClient: adminDb,
    reference,
  });

  if (!event) {
    return NextResponse.json({ error: "Payment reference not found." }, { status: 404 });
  }

  if (auth.role !== "admin" && event.profile_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (event.plan_tier) {
    const normalizedTier = event.plan_tier as PlanTier;
    if (auth.role !== "admin" && !deps.resolveTierForRole(auth.role, normalizedTier)) {
      await adminDb
        .from("provider_payment_events")
        .update({ status: "failed", reason: "role_mismatch" })
        .eq("id", event.id);
      return NextResponse.json({ error: "Plan tier not allowed for this role." }, { status: 403 });
    }
  }

  try {
    const result = await deps.finalizePaystackSubscriptionEvent({
      adminClient: adminDb,
      reference,
      event,
      actorUserId: auth.user.id,
    });

    if (result.status === "verified") {
      deps.logProviderPlanUpdated({
        request,
        route: routeLabel,
        provider: "paystack",
        profileId: result.profileId,
        planTier: result.planTier || event.plan_tier || "free",
        billingSource: "paystack",
        validUntil: result.validUntil,
      });
    }

    deps.logProviderVerifyOutcome({
      request,
      route: routeLabel,
      provider: "paystack",
      mode: result.mode || "test",
      reference,
      outcome: result.status === "failed" ? "failed" : result.status,
      reason: result.reason,
      profileId: result.profileId || event.profile_id,
    });

    if (result.status === "failed") {
      const messageByReason: Record<string, string> = {
        missing_metadata: "Payment metadata missing.",
        invalid_plan_tier: "Invalid plan tier.",
        config_missing: "Paystack is not configured. Add keys in Admin → Billing settings.",
        live_keys_missing: "Paystack live mode requires live keys. Switch to test or set live keys.",
        verify_failed: "Paystack verification failed.",
        plan_update_failed: "Unable to apply plan update.",
      };
      return NextResponse.json(
        { error: messageByReason[result.reason] || "Payment not successful." },
        { status: result.httpStatus }
      );
    }

    if (result.status === "skipped") {
      return NextResponse.json({ ok: true, status: "skipped", reason: result.reason });
    }

    if (result.status === "already_processed") {
      return NextResponse.json({ ok: true, status: "already_processed" });
    }

    return NextResponse.json({ ok: true, status: "verified", valid_until: result.validUntil });
  } catch (error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Paystack verification failed." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  return postPaystackVerifyResponse(request);
}
