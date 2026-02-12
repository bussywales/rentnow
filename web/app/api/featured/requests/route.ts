import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, getUserRole } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import {
  parseFeaturedRequestDuration,
  resolveFeaturedUntil,
  type FeaturedRequestDuration,
} from "@/lib/featured/requests";
import { getFeaturedEligibility } from "@/lib/featured/eligibility";
import { getFeaturedEligibilitySettings } from "@/lib/featured/eligibility.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/featured/requests";

const createSchema = z.object({
  propertyId: z.string().uuid(),
  durationDays: z.union([z.literal(7), z.literal(30), z.null()]).optional(),
  note: z.string().max(280).optional().nullable(),
});

export type FeaturedRequestDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  hasActiveDelegation: typeof hasActiveDelegation;
  getFeaturedEligibilitySettings: typeof getFeaturedEligibilitySettings;
};

const defaultDeps: FeaturedRequestDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireUser,
  getUserRole,
  hasActiveDelegation,
  getFeaturedEligibilitySettings,
};

type PropertyRow = {
  id: string;
  owner_id: string;
  title: string | null;
  city: string | null;
  status: string | null;
  is_active: boolean | null;
  is_approved: boolean | null;
  expires_at: string | null;
  is_demo: boolean | null;
  is_featured: boolean | null;
  featured_until: string | null;
  description: string | null;
  property_images?: Array<{ id: string | null }> | null;
};

function toDuration(value: unknown): FeaturedRequestDuration {
  return parseFeaturedRequestDuration(value);
}

function parseNote(value: string | null | undefined): string | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 280);
}

export async function postFeaturedRequestResponse(
  request: NextRequest,
  deps: FeaturedRequestDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({
    request,
    route: routeLabel,
    startTime,
    supabase,
  });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(supabase, auth.user.id);
  if (role !== "agent" && role !== "landlord") {
    return NextResponse.json({ error: "Only hosts can request featured slots." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 422 });
  }

  const propertyId = parsed.data.propertyId;
  const durationDays = toDuration(parsed.data.durationDays ?? null);
  const note = parseNote(parsed.data.note ?? null);

  const queryClient = deps.hasServiceRoleEnv() ? deps.createServiceRoleClient() : supabase;
  const featuredSettings = await deps.getFeaturedEligibilitySettings(queryClient);
  if (!featuredSettings.requestsEnabled) {
    return NextResponse.json(
      { error: "Featured requests are currently paused." },
      { status: 403 }
    );
  }

  const { data: propertyData, error: propertyError } = await queryClient
    .from("properties")
    .select(
      "id,owner_id,title,city,status,is_active,is_approved,expires_at,is_demo,is_featured,featured_until,description,property_images(id)"
    )
    .eq("id", propertyId)
    .maybeSingle();

  const property = (propertyData as PropertyRow | null) ?? null;
  if (propertyError || !property) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  if (property.owner_id !== auth.user.id) {
    if (role !== "agent") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const allowed = await deps.hasActiveDelegation(supabase, auth.user.id, property.owner_id);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: existingPending } = await queryClient
    .from("featured_requests")
    .select(
      "id,property_id,requester_user_id,requester_role,duration_days,requested_until,note,status,admin_note,created_at,updated_at"
    )
    .eq("property_id", propertyId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending) {
    return NextResponse.json({
      ok: true,
      pending: true,
      message: "Request pending.",
      request: existingPending,
    });
  }

  const eligibility = getFeaturedEligibility(
    {
      status: property.status,
      is_active: property.is_active,
      is_approved: property.is_approved,
      expires_at: property.expires_at,
      is_demo: property.is_demo,
      is_featured: property.is_featured,
      featured_until: property.featured_until,
      description: property.description,
      photo_count: Array.isArray(property.property_images) ? property.property_images.length : 0,
    },
    featuredSettings,
    { hasPendingRequest: false }
  );

  if (!eligibility.eligible) {
    return NextResponse.json(
      { error: eligibility.reasons[0] || "Not eligible yet." },
      { status: 409 }
    );
  }

  const requestedUntil = resolveFeaturedUntil(durationDays);
  const nowIso = new Date().toISOString();

  const { data: inserted, error: insertError } = await queryClient
    .from("featured_requests")
    .insert({
      property_id: propertyId,
      requester_user_id: auth.user.id,
      requester_role: role,
      duration_days: durationDays,
      requested_until: requestedUntil,
      note,
      status: "pending",
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select(
      "id,property_id,requester_user_id,requester_role,duration_days,requested_until,note,status,admin_note,created_at,updated_at"
    )
    .maybeSingle();

  if (insertError) {
    const code = (insertError as { code?: string }).code;
    if (code === "23505") {
      const { data: retryPending } = await queryClient
        .from("featured_requests")
        .select(
          "id,property_id,requester_user_id,requester_role,duration_days,requested_until,note,status,admin_note,created_at,updated_at"
        )
        .eq("property_id", propertyId)
        .eq("status", "pending")
        .maybeSingle();
      if (retryPending) {
        return NextResponse.json({
          ok: true,
          pending: true,
          message: "Request pending.",
          request: retryPending,
        });
      }
    }
    return NextResponse.json({ error: insertError.message || "Unable to create request." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    pending: false,
    message: "Request sent. We'll review shortly.",
    request: inserted,
  });
}

export async function getFeaturedRequestsResponse(
  request: NextRequest,
  deps: FeaturedRequestDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({ request, route: routeLabel, startTime, supabase });
  if (!auth.ok) return auth.response;

  const mineOnly = request.nextUrl.searchParams.get("mine") !== "0";

  let query = supabase
    .from("featured_requests")
    .select(
      "id,property_id,requester_user_id,requester_role,duration_days,requested_until,note,status,admin_note,decided_by,decided_at,created_at,updated_at,properties(id,title,city,is_featured,featured_until,status,is_demo)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (mineOnly) {
    query = query.eq("requester_user_id", auth.user.id);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message || "Unable to load requests." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, requests: data || [] });
}

export async function POST(request: NextRequest) {
  return postFeaturedRequestResponse(request);
}

export async function GET(request: NextRequest) {
  return getFeaturedRequestsResponse(request);
}
