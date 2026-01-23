import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import {
  VIDEO_STORAGE_BUCKET,
  MAX_VIDEO_BYTES,
  isAllowedVideoSize,
  isAllowedVideoType,
  buildVideoPath,
} from "@/lib/properties/video";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return NextResponse.json(
      {
        error:
          "Video storage isn't configured yet. Ask an admin to create the 'property-videos' bucket in Supabase Storage.",
        code: "STORAGE_BUCKET_NOT_FOUND",
      },
      { status: 503 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({
    request,
    route: `/api/properties/${id}/video/init`,
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

  const actingAs = readActingAsFromRequest(request);
  let ownerId = auth.user.id;
  if (role === "agent" && actingAs && actingAs !== auth.user.id) {
    const allowed = await hasActiveDelegation(supabase, auth.user.id, actingAs);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden", code: "VIDEO_NOT_ALLOWED" }, { status: 403 });
    }
    ownerId = actingAs;
  }

  const { data: propertyRow } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!propertyRow) {
    return NextResponse.json({ error: "Listing not found.", code: "not_found" }, { status: 404 });
  }
  if (propertyRow.owner_id !== ownerId && role !== "admin") {
    return NextResponse.json(
      { error: "You don't have permission to upload a video for this listing.", code: "VIDEO_NOT_ALLOWED" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const contentType = typeof body?.contentType === "string" ? body.contentType : null;
  const bytes = typeof body?.bytes === "number" ? body.bytes : null;
  if (!contentType || !isAllowedVideoType(contentType)) {
    return NextResponse.json({ error: "Upload an MP4.", code: "unsupported" }, { status: 400 });
  }
  if (!bytes || !isAllowedVideoSize(bytes)) {
    return NextResponse.json(
      { error: "Video must be 20MB or less.", code: "too_large", maxBytes: MAX_VIDEO_BYTES },
      { status: 400 }
    );
  }

  const adminClient = createServiceRoleClient();
  const path = buildVideoPath(id, randomUUID());
  const signed = await adminClient.storage.from(VIDEO_STORAGE_BUCKET).createSignedUploadUrl(path);

  if (signed.error || !signed.data) {
    const message = signed.error?.message || "Unable to prepare upload.";
    const bucketMissing = message.toLowerCase().includes("bucket") && message.toLowerCase().includes("not found");
    return NextResponse.json(
      {
        error: bucketMissing
          ? "Video storage isn't configured yet. Ask an admin to create the 'property-videos' bucket in Supabase Storage."
          : message,
        code: bucketMissing ? "STORAGE_BUCKET_NOT_FOUND" : "upload_init_failed",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    bucket: VIDEO_STORAGE_BUCKET,
    path,
    signedUrl: signed.data.signedUrl,
    token: signed.data.token,
    contentType,
    bytes,
  });
}
