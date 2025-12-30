import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { logPlanOverride } from "@/lib/observability";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

const routeLabel = "/api/admin/plans";

const bodySchema = z.object({
  profileId: z.string().uuid(),
  planTier: z.enum(["free", "starter", "pro"]),
  maxListingsOverride: z.number().int().positive().nullable().optional(),
});

export async function PATCH(request: Request) {
  const startTime = Date.now();

  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; plan overrides unavailable." },
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

  const payload = bodySchema.parse(await request.json());
  const maxOverride =
    typeof payload.maxListingsOverride === "number"
      ? payload.maxListingsOverride
      : null;

  const adminClient = createServiceRoleClient();
  const { error } = await (adminClient as unknown as { from: (table: string) => any })
    .from("profile_plans")
    .upsert(
      {
        profile_id: payload.profileId,
        plan_tier: payload.planTier,
        max_listings_override: maxOverride,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      },
      { onConflict: "profile_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  logPlanOverride({
    request,
    route: routeLabel,
    actorId: auth.user.id,
    profileId: payload.profileId,
    planTier: payload.planTier,
    maxListingsOverride: maxOverride,
  });

  return NextResponse.json({ ok: true });
}
