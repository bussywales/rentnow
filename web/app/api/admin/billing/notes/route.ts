import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { logBillingNoteUpdated } from "@/lib/observability";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

const routeLabel = "/api/admin/billing/notes";

const schema = z.object({
  profileId: z.string().uuid(),
  note: z.string().max(2000),
});

export async function PATCH(request: Request) {
  const startTime = Date.now();

  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; billing notes unavailable." },
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
  const note = payload.note.trim();
  if (!note) {
    return NextResponse.json({ error: "Billing note cannot be empty." }, { status: 400 });
  }

  const adminClient = createServiceRoleClient();
  const now = new Date().toISOString();
  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      upsert: (
        values: Record<string, unknown>,
        options?: { onConflict?: string }
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await adminDb
    .from("profile_billing_notes")
    .upsert(
      {
        profile_id: payload.profileId,
        billing_notes: note,
        updated_at: now,
        updated_by: auth.user.id,
      },
      { onConflict: "profile_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  logBillingNoteUpdated({
    request,
    route: routeLabel,
    actorId: auth.user.id,
    profileId: payload.profileId,
  });

  return NextResponse.json({ ok: true });
}
