import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserRole, requireUser } from "@/lib/authz";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { haversineDistanceMeters, bucketDistance, sanitizeAccuracyM } from "@/lib/properties/checkins";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const bodySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy_m: z.number().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  if (!hasServiceRoleEnv() || !hasServerSupabaseEnv()) {
    return NextResponse.json(
      { error: "Service role env vars missing", code: "not_configured" },
      { status: 503 }
    );
  }

  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({
    request,
    route: "/api/properties/[id]/check-in",
    supabase,
    startTime,
  });
  if (!auth.ok) return auth.response;

  const service = createServiceRoleClient() as unknown as UntypedAdminClient;
  const role = await getUserRole(supabase, auth.user.id);

  if (!["admin", "landlord", "agent"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: property, error: propError } = await service
    .from("properties")
    .select("id, owner_id, latitude, longitude")
    .eq("id", id)
    .maybeSingle();
  const propertyRow = property as { owner_id?: string; latitude?: number | null; longitude?: number | null } | null;
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (role === "agent") {
      const allowed = await hasActiveDelegation(supabase, auth.user.id, ownerId);
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
