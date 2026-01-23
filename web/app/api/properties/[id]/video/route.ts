import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { VIDEO_BUCKET, isAllowedVideoSize, isAllowedVideoType, videoExtensionForType, MAX_VIDEO_BYTES } from "@/lib/properties/video";

export const dynamic = "force-dynamic";

async function resolveOwnerId({
  request,
  propertyId,
  supabase,
  userId,
  role,
}: {
  request: NextRequest;
  propertyId: string;
  supabase: ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never;
  userId: string;
  role: string | null;
}) {
  let ownerId = userId;
  if (role === "agent") {
    const actingAs = readActingAsFromRequest(request);
    if (actingAs && actingAs !== userId) {
      const allowed = await hasActiveDelegation(supabase, userId, actingAs);
      if (!allowed) return { ok: false as const, status: 403 as const };
      ownerId = actingAs;
    }
  }

  const { data: propertyRow, error: propertyError } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError || !propertyRow) {
    return { ok: false as const, status: 404 as const, message: "Property not found." };
  }
  if (propertyRow.owner_id !== ownerId && role !== "admin") {
    return { ok: false as const, status: 403 as const, message: "Forbidden" };
  }
  return { ok: true as const };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json(
      { error: "Supabase not configured; cannot upload video." },
      { status: 503 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({
    request,
    route: `/api/properties/${id}/video`,
    startTime: Date.now(),
    supabase,
  });
  if (!auth.ok || !auth.user) {
    return NextResponse.json(
      { error: "Please log in to manage listings.", code: "not_authenticated" },
      { status: 401 }
    );
  }

  const role = await getUserRole(supabase, auth.user.id);
  const access = getListingAccessResult(role, true);
  if (!access.ok) {
    return NextResponse.json({ error: access.message, code: access.code }, { status: access.status });
  }

  const ownerCheck = await resolveOwnerId({ request, propertyId: id, supabase, userId: auth.user.id, role });
  if (!ownerCheck.ok) {
    return NextResponse.json({ error: ownerCheck.message || "Forbidden" }, { status: ownerCheck.status });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing video file." }, { status: 400 });
  }

  if (!isAllowedVideoType(file.type)) {
    return NextResponse.json({ error: "Upload an MP4 (or MOV).", code: "unsupported" }, { status: 400 });
  }
  if (!isAllowedVideoSize(file.size)) {
    return NextResponse.json({ error: "Video must be 20MB or less.", code: "too_large", maxBytes: MAX_VIDEO_BYTES }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("property_videos")
    .select("storage_path")
    .eq("property_id", id)
    .maybeSingle();

  const ext = videoExtensionForType(file.type);
  const path = `${id}/${randomUUID()}.${ext}`;

  const uploadResult = await supabase.storage
    .from(VIDEO_BUCKET)
    .upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type,
    });
  if (uploadResult.error) {
    return NextResponse.json({ error: uploadResult.error.message }, { status: 400 });
  }

  const { data: publicUrlData } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path);
  const videoUrl = publicUrlData.publicUrl;

  const upsertRes = await supabase
    .from("property_videos")
    .upsert(
      {
        property_id: id,
        video_url: videoUrl,
        storage_path: path,
        bytes: file.size,
        format: file.type,
      },
      { onConflict: "property_id" }
    )
    .select("video_url, storage_path")
    .maybeSingle();

  if (upsertRes.error) {
    return NextResponse.json({ error: upsertRes.error.message }, { status: 400 });
  }

  if (existing?.storage_path && existing.storage_path !== path) {
    void supabase.storage.from(VIDEO_BUCKET).remove([existing.storage_path]);
  }

  return NextResponse.json({
    video_url: videoUrl,
    bytes: file.size,
    format: file.type,
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json(
      { error: "Supabase not configured; cannot delete video." },
      { status: 503 }
    );
  }
  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({
    request,
    route: `/api/properties/${id}/video`,
    startTime: Date.now(),
    supabase,
  });
  if (!auth.ok || !auth.user) {
    return NextResponse.json(
      { error: "Please log in to manage listings.", code: "not_authenticated" },
      { status: 401 }
    );
  }
  const role = await getUserRole(supabase, auth.user.id);
  const access = getListingAccessResult(role, true);
  if (!access.ok) {
    return NextResponse.json({ error: access.message, code: access.code }, { status: access.status });
  }
  const ownerCheck = await resolveOwnerId({ request, propertyId: id, supabase, userId: auth.user.id, role });
  if (!ownerCheck.ok) {
    return NextResponse.json({ error: ownerCheck.message || "Forbidden" }, { status: ownerCheck.status });
  }

  const { data: existing } = await supabase
    .from("property_videos")
    .select("storage_path")
    .eq("property_id", id)
    .maybeSingle();

  if (existing?.storage_path) {
    void supabase.storage.from(VIDEO_BUCKET).remove([existing.storage_path]);
  }

  const { error: deleteError } = await supabase.from("property_videos").delete().eq("property_id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
