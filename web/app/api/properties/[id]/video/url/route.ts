import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { SIGNED_VIDEO_URL_TTL_SECONDS, VIDEO_STORAGE_BUCKET } from "@/lib/properties/video";

export const dynamic = "force-dynamic";

export type VideoUrlDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  getListingAccessResult: typeof getListingAccessResult;
  readActingAsFromRequest: typeof readActingAsFromRequest;
  hasActiveDelegation: typeof hasActiveDelegation;
};

const defaultDeps: VideoUrlDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireUser,
  getUserRole,
  getListingAccessResult,
  readActingAsFromRequest,
  hasActiveDelegation,
};

export async function handleVideoSignedUrl(
  request: NextRequest,
  propertyId: string,
  deps: VideoUrlDeps = defaultDeps
) {
  if (!deps.hasServerSupabaseEnv() || !deps.hasServiceRoleEnv()) {
    return NextResponse.json(
      {
        error:
          "Video storage isn't configured yet. Ask an admin to create the 'property-videos' bucket in Supabase Storage.",
        code: "VIDEO_BUCKET_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({
    request,
    route: `/api/properties/${propertyId}/video/url`,
    startTime: Date.now(),
    supabase,
  });
  if (!auth.ok || !auth.user) {
    return NextResponse.json(
      { error: "Please log in to manage listings.", code: "not_authenticated" },
      { status: 401 }
    );
  }

  const role = await deps.getUserRole(supabase, auth.user.id);
  const access = deps.getListingAccessResult(role, true);
  if (!access.ok) {
    return NextResponse.json({ error: access.message, code: access.code }, { status: access.status });
  }

  const actingAs = deps.readActingAsFromRequest(request);
  let ownerId = auth.user.id;
  if (role === "agent" && actingAs && actingAs !== auth.user.id) {
    const allowed = await deps.hasActiveDelegation(supabase, auth.user.id, actingAs);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden", code: "VIDEO_NOT_ALLOWED" }, { status: 403 });
    }
    ownerId = actingAs;
  }

  const { data: propertyRow } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!propertyRow) {
    return NextResponse.json({ error: "Listing not found.", code: "not_found" }, { status: 404 });
  }
  if (propertyRow.owner_id !== ownerId && role !== "admin") {
    return NextResponse.json(
      { error: "You don't have permission to view this video.", code: "VIDEO_NOT_ALLOWED" },
      { status: 403 }
    );
  }

  const { data: videoRow } = await supabase
    .from("property_videos")
    .select("storage_path")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!videoRow?.storage_path) {
    return NextResponse.json(
      { error: "No video found for this listing.", code: "VIDEO_NOT_FOUND" },
      { status: 404 }
    );
  }

  const adminClient = deps.createServiceRoleClient();
  const signed = await adminClient.storage
    .from(VIDEO_STORAGE_BUCKET)
    .createSignedUrl(videoRow.storage_path, SIGNED_VIDEO_URL_TTL_SECONDS);

  if (signed.error || !signed.data?.signedUrl) {
    const message = signed.error?.message || "Unable to sign video URL.";
    const bucketMissing = message.toLowerCase().includes("bucket") && message.toLowerCase().includes("not found");
    return NextResponse.json(
      {
        error: bucketMissing
          ? "Video storage isn't configured yet. Ask an admin to create the 'property-videos' bucket in Supabase Storage."
          : message,
        code: bucketMissing ? "VIDEO_BUCKET_NOT_CONFIGURED" : "VIDEO_SIGN_ERROR",
      },
      { status: bucketMissing ? 503 : 400 }
    );
  }

  return NextResponse.json({
    url: signed.data.signedUrl,
    expiresIn: SIGNED_VIDEO_URL_TTL_SECONDS,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handleVideoSignedUrl(request, id);
}
