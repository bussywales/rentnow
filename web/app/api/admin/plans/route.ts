import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { logPlanOverride } from "@/lib/observability";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

const routeLabel = "/api/admin/plans";

const bodySchema = z.object({
  profileId: z.string().uuid(),
  planTier: z.enum(["free", "starter", "pro", "tenant_pro"]),
  maxListingsOverride: z.number().int().positive().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  billingNotes: z.string().max(2000).nullable().optional(),
  billingSource: z.enum(["manual", "stripe", "paystack", "flutterwave"]).optional(),
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
  const validUntil =
    typeof payload.validUntil === "string" ? payload.validUntil : null;
  const billingSource = payload.billingSource ?? "manual";

  const adminClient = createServiceRoleClient();
  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      upsert: (
        values: Record<string, unknown>,
        options?: { onConflict?: string }
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await adminDb
    .from("profile_plans")
    .upsert(
      {
        profile_id: payload.profileId,
        plan_tier: payload.planTier,
        max_listings_override: maxOverride,
        billing_source: billingSource,
        valid_until: validUntil,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
        upgraded_at: new Date().toISOString(),
        upgraded_by: auth.user.id,
      },
      { onConflict: "profile_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (typeof payload.billingNotes === "string") {
    await adminDb
      .from("profile_billing_notes")
      .upsert(
        {
          profile_id: payload.profileId,
          billing_notes: payload.billingNotes,
          updated_at: new Date().toISOString(),
          updated_by: auth.user.id,
        },
        { onConflict: "profile_id" }
      );
  }

  logPlanOverride({
    request,
    route: routeLabel,
    actorId: auth.user.id,
    profileId: payload.profileId,
    planTier: payload.planTier,
    maxListingsOverride: maxOverride,
    billingSource,
    validUntil,
  });

  return NextResponse.json({ ok: true });
}
