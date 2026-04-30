import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/authz";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";
import {
  moveReadyProviderApplicationStatusSchema,
  moveReadyProviderStatusSchema,
  moveReadyProviderVerificationStateSchema,
} from "@/lib/services/move-ready";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    status: moveReadyProviderApplicationStatusSchema.optional(),
    providerStatus: moveReadyProviderStatusSchema.optional(),
    verificationState: moveReadyProviderVerificationStateSchema.optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    adminNotes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((input) => Boolean(input.status || input.providerStatus || input.verificationState || input.notes !== undefined || input.adminNotes !== undefined), {
    message: "At least one field is required.",
  });

type ProviderStatusDeps = {
  hasServiceRoleEnv: () => boolean;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  logProductAnalyticsEvent: typeof logProductAnalyticsEvent;
  now: () => Date;
};

const defaultDeps: ProviderStatusDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  requireRole,
  logProductAnalyticsEvent,
  now: () => new Date(),
};

export async function patchAdminMoveReadyProviderResponse(
  request: NextRequest,
  providerId: string,
  deps: ProviderStatusDeps = defaultDeps
) {
  const auth = await deps.requireRole({
    request,
    route: "/api/admin/services/providers/[id]",
    startTime: Date.now(),
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Services admin is unavailable." }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider update payload.", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const client = deps.createServiceRoleClient();
  const nowIso = deps.now().toISOString();
  const updatePayload: Record<string, unknown> = {
    updated_at: nowIso,
  };

  if (parsed.data.notes !== undefined) updatePayload.notes = parsed.data.notes;
  if (parsed.data.adminNotes !== undefined) updatePayload.admin_notes = parsed.data.adminNotes;

  if (parsed.data.status) {
    switch (parsed.data.status) {
      case "approved":
        updatePayload.verification_state = "approved";
        updatePayload.provider_status = "active";
        updatePayload.approved_at = nowIso;
        updatePayload.approved_by = auth.user.id;
        updatePayload.rejected_at = null;
        updatePayload.rejected_by = null;
        updatePayload.suspended_at = null;
        updatePayload.suspended_by = null;
        break;
      case "rejected":
        updatePayload.verification_state = "rejected";
        updatePayload.provider_status = "paused";
        updatePayload.rejected_at = nowIso;
        updatePayload.rejected_by = auth.user.id;
        updatePayload.approved_at = null;
        updatePayload.approved_by = null;
        updatePayload.suspended_at = null;
        updatePayload.suspended_by = null;
        break;
      case "suspended":
        updatePayload.verification_state = "approved";
        updatePayload.provider_status = "paused";
        updatePayload.suspended_at = nowIso;
        updatePayload.suspended_by = auth.user.id;
        break;
      case "pending":
      default:
        updatePayload.verification_state = "pending";
        updatePayload.provider_status = "paused";
        break;
    }
  } else {
    if (parsed.data.providerStatus) updatePayload.provider_status = parsed.data.providerStatus;
    if (parsed.data.verificationState) updatePayload.verification_state = parsed.data.verificationState;
  }

  const { error } = await client
    .from("move_ready_service_providers")
    .update(updatePayload as never)
    .eq("id", providerId);

  if (error) {
    return NextResponse.json({ error: "Unable to update provider." }, { status: 500 });
  }

  if (parsed.data.status === "approved" || parsed.data.status === "rejected") {
    await deps.logProductAnalyticsEvent({
      eventName:
        parsed.data.status === "approved"
          ? "property_prep_supplier_approved"
          : "property_prep_supplier_rejected",
      supabase: client,
      userId: auth.user.id,
      userRole: auth.role,
      properties: {
        role: auth.role,
        providerId,
        action: parsed.data.status,
        pagePath: "/admin/services/providers",
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return patchAdminMoveReadyProviderResponse(request, id);
}
