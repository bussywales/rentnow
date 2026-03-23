import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getUserRole, requireUser } from "@/lib/authz";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { haversineDistanceMeters, bucketDistance, sanitizeAccuracyM } from "@/lib/properties/checkins";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/properties/[id]/check-in";

const bodySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy_m: z.number().optional(),
});

export type PropertyCheckinDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  hasActiveDelegation: typeof hasActiveDelegation;
};

const defaultDeps: PropertyCheckinDeps = {
  hasServiceRoleEnv,
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireUser,
  getUserRole,
  hasActiveDelegation,
};

const getAnonEnv = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
}

async function createRequestSupabaseClient(
  accessToken: string | null,
  deps: PropertyCheckinDeps
) {
  const env = accessToken ? getAnonEnv() : null;
  if (accessToken && env) {
    return createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }
  return deps.createServerSupabaseClient();
}

function forbidden(error: string, code: string) {
  return NextResponse.json({ error, code }, { status: 403 });
}

export async function postPropertyCheckinResponse(
  request: Request,
  context: { params: Promise<{ id: string }> },
  deps: PropertyCheckinDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServiceRoleEnv() || !deps.hasServerSupabaseEnv()) {
    return NextResponse.json(
      { error: "Service role env vars missing", code: "not_configured" },
      { status: 503 }
    );
  }

  const { id } = await context.params;
  const accessToken = getBearerToken(request);
  const supabase = await createRequestSupabaseClient(accessToken, deps);
  const auth = await deps.requireUser({
    request,
    route: routeLabel,
    supabase,
    accessToken,
    startTime,
  });
  if (!auth.ok) return auth.response;

  const service = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
  const role = await deps.getUserRole(auth.supabase, auth.user.id);

  if (!role || !["admin", "landlord", "agent"].includes(role)) {
    return forbidden(
      "Property check-in is available to admins, landlords, and delegated agents.",
      "role_not_allowed"
    );
  }

  const { data: property, error: propError } = await service
    .from("properties")
    .select("id, owner_id, latitude, longitude")
    .eq("id", id)
    .maybeSingle();
  const propertyRow = property as {
    owner_id?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;

  if (propError) return NextResponse.json({ error: propError.message }, { status: 400 });
  if (!propertyRow) return NextResponse.json({ error: "Property not found" }, { status: 404 });
  if (!propertyRow.owner_id) {
    return NextResponse.json({ error: "Property owner missing" }, { status: 400 });
  }
  if (propertyRow.latitude === null || propertyRow.longitude === null) {
    return NextResponse.json(
      { error: "Pin required before check-in", code: "pin_required" },
      { status: 400 }
    );
  }

  if (role !== "admin") {
    const ownerId = propertyRow.owner_id;
    if (role === "landlord" && ownerId !== auth.user.id) {
      return forbidden(
        "You’re signed in, but only the listing owner or a delegated manager can check in here.",
        "listing_relation_required"
      );
    }
    if (role === "agent") {
      const allowed = await deps.hasActiveDelegation(auth.supabase, auth.user.id, ownerId);
      if (!allowed) {
        return forbidden(
          "You’re signed in, but only the listing owner or a delegated manager can check in here.",
          "listing_relation_required"
        );
      }
    }
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success || !Number.isFinite(parsed.data.lat) || !Number.isFinite(parsed.data.lng)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }
  const { lat, lng, accuracy_m } = parsed.data;

  const distance = haversineDistanceMeters({
    lat1: propertyRow.latitude as number,
    lng1: propertyRow.longitude as number,
    lat2: lat,
    lng2: lng,
  });
  const bucket = bucketDistance(distance);
  const accuracy = sanitizeAccuracyM(accuracy_m);

  const { error: insertError } = await service.from("property_checkins").insert([
    {
      property_id: id,
      distance_bucket: bucket,
      method: "browser_geolocation",
      accuracy_m: accuracy,
      verified_by: auth.user.id,
      role,
    },
  ]);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const checkedInAt = new Date().toISOString();
  return NextResponse.json({ ok: true, bucket, checkedInAt });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return postPropertyCheckinResponse(request, context);
}
