import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { safeTrim } from "@/lib/agents/agent-storefront";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { logPropertyEvent, resolveEventSessionKey } from "@/lib/analytics/property-events.server";

const routeLabel = "/api/agent/client-pages/[id]/external-listings";

const payloadSchema = z.object({
  listingId: z.string().uuid(),
  pinned: z.boolean().optional(),
  rank: z.number().int().min(0).optional(),
  commission_type: z.enum(["percentage", "fixed", "none"]).optional(),
  commission_value: z.number().min(0).nullable().optional(),
  currency: z.string().max(8).nullable().optional(),
  notes: z.string().max(800).nullable().optional(),
});

type RouteContext = { params: Promise<{ id?: string }> };

type PageRow = { id: string; agent_user_id: string };

async function ensureOwnership(
  supabase: SupabaseClient,
  pageId: string,
  userId: string
) {
  const { data } = await supabase
    .from("agent_client_pages")
    .select("id, agent_user_id")
    .eq("id", pageId)
    .maybeSingle();
  if (!data) return { ok: false, status: 404, error: "Client page not found." };
  if (data.agent_user_id !== userId) return { ok: false, status: 403, error: "Forbidden." };
  return { ok: true, page: data as PageRow };
}

export type ExternalListingDeps = {
  requireRole: typeof requireRole;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  getAppSettingBool: typeof getAppSettingBool;
  createServiceRoleClient: typeof createServiceRoleClient;
  logPropertyEvent: typeof logPropertyEvent;
  resolveEventSessionKey: typeof resolveEventSessionKey;
};

const defaultDeps: ExternalListingDeps = {
  requireRole,
  hasServiceRoleEnv,
  getAppSettingBool,
  createServiceRoleClient,
  logPropertyEvent,
  resolveEventSessionKey,
};

export async function postExternalListingResponse(
  request: Request,
  { params }: RouteContext,
  deps: ExternalListingDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured." }, { status: 503 });
  }

  const networkEnabled = await deps.getAppSettingBool(
    APP_SETTING_KEYS.agentNetworkDiscoveryEnabled,
    false
  );
  if (!networkEnabled) {
    return NextResponse.json(
      { error: "Agent network discovery is disabled." },
      { status: 403 }
    );
  }

  const resolvedParams = await params;
  const pageId = safeTrim(resolvedParams?.id);
  if (!pageId) {
    return NextResponse.json({ error: "Missing client page id." }, { status: 400 });
  }

  const payload = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const ownership = await ensureOwnership(auth.supabase, pageId, auth.user.id);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  const adminClient = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
  const { data: listing } = await adminClient
    .from("properties")
    .select("id, owner_id, status")
    .eq("id", payload.data.listingId)
    .maybeSingle();

  const resolvedListing = listing as
    | { id: string; owner_id: string; status?: string | null }
    | null;

  if (!resolvedListing || resolvedListing.status !== "live") {
    return NextResponse.json({ error: "Listing not available." }, { status: 404 });
  }

  const insertPayload = {
    client_page_id: pageId,
    property_id: payload.data.listingId,
    pinned: payload.data.pinned ?? false,
    rank: payload.data.rank ?? 0,
  };

  const { error: curatedError } = await auth.supabase
    .from("agent_client_page_listings")
    .upsert(insertPayload, { onConflict: "client_page_id,property_id" });

  if (curatedError) {
    return NextResponse.json({ error: curatedError.message }, { status: 400 });
  }

  const { error: shareError } = await adminClient
    .from("agent_listing_shares")
    .upsert(
      {
        client_page_id: pageId,
        listing_id: payload.data.listingId,
        owner_user_id: resolvedListing.owner_id,
        presenting_user_id: auth.user.id,
        mode: "share",
      },
      { onConflict: "client_page_id,listing_id" }
    );

  if (shareError) {
    return NextResponse.json({ error: shareError.message }, { status: 400 });
  }

  const commissionType = payload.data.commission_type ?? null;
  const commissionNotes = safeTrim(payload.data.notes ?? null);
  const shouldCreateAgreement =
    commissionType !== null && commissionType !== "none";
  const normalizedValue =
    commissionType && commissionType !== "none" ? payload.data.commission_value ?? null : null;
  if (shouldCreateAgreement || commissionNotes) {
    const agreementPayload = {
      listing_id: payload.data.listingId,
      owner_agent_id: resolvedListing.owner_id,
      presenting_agent_id: auth.user.id,
      commission_type: commissionType ?? "none",
      commission_value: normalizedValue,
      currency: payload.data.currency ?? null,
      status: "proposed",
      notes: commissionNotes || null,
    };

    const { error: agreementError } = await auth.supabase
      .from("agent_commission_agreements")
      .upsert(agreementPayload, { onConflict: "listing_id,presenting_agent_id" });

    if (agreementError) {
      return NextResponse.json({ error: agreementError.message }, { status: 400 });
    }
  }

  const sessionKey = deps.resolveEventSessionKey({ request, userId: auth.user.id });
  void deps.logPropertyEvent({
    supabase: auth.supabase,
    propertyId: payload.data.listingId,
    eventType: "agent_network_shared",
    actorUserId: auth.user.id,
    actorRole: "agent",
    sessionKey,
    meta: {
      clientPageId: pageId,
      ownerUserId: resolvedListing.owner_id,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: RouteContext) {
  return postExternalListingResponse(request, { params });
}
