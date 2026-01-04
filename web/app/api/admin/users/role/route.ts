import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { ROLE_VALUES, normalizeRole } from "@/lib/roles";
import { logAdminRoleChanged, logFailure } from "@/lib/observability";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/users/role";

const payloadSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum(ROLE_VALUES),
  reason: z.string().min(3),
});

export async function POST(request: Request) {
  const startTime = Date.now();
  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; role updates unavailable." },
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

  const body = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { profileId, role, reason } = parsed.data;
  const adminClient = createServiceRoleClient();
  const adminDb = adminClient as unknown as UntypedAdminClient;

  const { data: existingProfile, error: fetchError } = await adminDb
    .from<{ role: string | null }>("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();

  if (fetchError) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: fetchError,
    });
    return NextResponse.json({ error: "Unable to load profile." }, { status: 500 });
  }

  if (!existingProfile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const oldRole = normalizeRole(existingProfile.role ?? null);
  if (oldRole === role) {
    return NextResponse.json({ ok: true, status: "no_change" });
  }

  const { error: updateError } = await adminDb
    .from("profiles")
    .update({ role })
    .eq("id", profileId);

  if (updateError) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: updateError,
    });
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: auditError } = await adminDb.from("role_change_audit").insert({
    target_profile_id: profileId,
    actor_profile_id: auth.user.id,
    old_role: oldRole,
    new_role: role,
    reason: reason.trim(),
  });

  if (auditError) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: auditError,
    });
    return NextResponse.json(
      { error: "Role updated but audit logging failed." },
      { status: 500 }
    );
  }

  logAdminRoleChanged({
    request,
    route: routeLabel,
    actorId: auth.user.id,
    targetProfileId: profileId,
    oldRole,
    newRole: role,
    reasonProvided: true,
  });

  return NextResponse.json({ ok: true });
}
