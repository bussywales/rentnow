import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getUserRole, requireUser, requireOwnership } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getFeaturedConfig } from "@/lib/billing/featured";
import { consumeFeaturedCredit } from "@/lib/billing/featured-credits.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  idempotencyKey: z.string().min(8).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({ request, route: `/api/properties/${id}/feature`, startTime: Date.now(), supabase });
  if (!auth.ok) return auth.response;

  const role = await getUserRole(supabase, auth.user.id);
  const access = getListingAccessResult(role, true);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message, code: access.code },
      { status: access.status }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const serviceClient = createServiceRoleClient();
  const adminClient = serviceClient as unknown as UntypedAdminClient;
  const { data: listing, error } = await adminClient
    .from("properties")
    .select("id, owner_id, status, is_featured, featured_until")
    .eq("id", id)
    .maybeSingle();

  const typedListing = listing as {
    id: string;
    owner_id: string;
    status?: string | null;
    is_featured?: boolean | null;
    featured_until?: string | null;
  } | null;

  if (error || !typedListing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const ownership = requireOwnership({
    request,
    route: `/api/properties/${id}/feature`,
    startTime: Date.now(),
    resourceOwnerId: typedListing.owner_id,
    userId: auth.user.id,
    role,
    allowRoles: ["admin"],
  });
  if (!ownership.ok) {
    if (role === "agent") {
      const allowed = await hasActiveDelegation(supabase, auth.user.id, typedListing.owner_id);
      if (!allowed) return ownership.response;
    } else {
      return ownership.response;
    }
  }

  if (typedListing.status !== "live") {
    return NextResponse.json({ error: "Listing must be live to feature." }, { status: 409 });
  }

  const nowMs = Date.now();
  const featuredUntilMs = typedListing.featured_until ? Date.parse(typedListing.featured_until) : null;
  const featuredActive =
    !!typedListing.is_featured &&
    (!featuredUntilMs || (Number.isFinite(featuredUntilMs) && featuredUntilMs > nowMs));
  if (featuredActive) {
    return NextResponse.json({ error: "Listing is already featured." }, { status: 409 });
  }

  const idempotencyKey = parsed.data.idempotencyKey || crypto.randomUUID();
  const consumed = await consumeFeaturedCredit({
    client: serviceClient,
    userId: typedListing.owner_id,
    listingId: typedListing.id,
    idempotencyKey,
  });

  if (!consumed.ok) {
    if (consumed.reason === "NO_CREDITS") {
      const config = await getFeaturedConfig();
      return NextResponse.json(
        {
          ok: false,
          reason: "PAYMENT_REQUIRED",
          amount: config.paygAmount,
          currency: config.currency,
        },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: consumed.reason }, { status: 400 });
  }

  const config = await getFeaturedConfig();
  const now = new Date().toISOString();
  const featuredUntil = new Date(Date.now() + config.durationDays * 24 * 60 * 60 * 1000).toISOString();
  await adminClient
    .from("properties")
    .update({
      is_featured: true,
      featured_until: featuredUntil,
      featured_at: now,
      featured_by: typedListing.owner_id,
      updated_at: now,
    })
    .eq("id", typedListing.id);

  return NextResponse.json({
    ok: true,
    featured_until: featuredUntil,
    idempotencyKey,
  });
}
