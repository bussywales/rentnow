import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/authz";
import {
  moveReadyProviderStatusSchema,
  moveReadyProviderVerificationStateSchema,
} from "@/lib/services/move-ready";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    providerStatus: moveReadyProviderStatusSchema.optional(),
    verificationState: moveReadyProviderVerificationStateSchema.optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((input) => Boolean(input.providerStatus || input.verificationState || input.notes !== undefined), {
    message: "At least one field is required.",
  });

type ProviderStatusDeps = {
  hasServiceRoleEnv: () => boolean;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  now: () => Date;
};

const defaultDeps: ProviderStatusDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  requireRole,
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
  const { error } = await client
    .from("move_ready_service_providers")
    .update(
      {
        provider_status: parsed.data.providerStatus,
        verification_state: parsed.data.verificationState,
        notes: parsed.data.notes,
        updated_at: deps.now().toISOString(),
      } as never
    )
    .eq("id", providerId);

  if (error) {
    return NextResponse.json({ error: "Unable to update provider." }, { status: 500 });
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
