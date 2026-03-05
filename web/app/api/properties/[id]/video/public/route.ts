import { NextResponse, type NextRequest } from "next/server";
import { getUserRole } from "@/lib/authz";
import {
  canShowExpiredListingPublic,
  isListingPubliclyVisible,
  type ListingVisibilityInput,
} from "@/lib/properties/expiry";
import {
  SIGNED_VIDEO_URL_TTL_SECONDS,
  VIDEO_STORAGE_BUCKET,
} from "@/lib/properties/video";
import { normalizeRole } from "@/lib/roles";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { includeDemoListingsForViewerFromSettings } from "@/lib/settings/demo";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  createServerSupabaseClient,
  hasServerSupabaseEnv,
} from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

type PublicVideoPropertyRow = ListingVisibilityInput & {
  id: string;
  owner_id?: string | null;
  is_demo?: boolean | null;
};

export type PublicVideoRouteDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  getUserRole: typeof getUserRole;
  includeDemoListingsForViewerFromSettings: typeof includeDemoListingsForViewerFromSettings;
  getAppSettingBool: typeof getAppSettingBool;
  isListingPubliclyVisible: typeof isListingPubliclyVisible;
  canShowExpiredListingPublic: typeof canShowExpiredListingPublic;
  now: () => Date;
};

const defaultDeps: PublicVideoRouteDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  getUserRole,
  includeDemoListingsForViewerFromSettings,
  getAppSettingBool,
  isListingPubliclyVisible,
  canShowExpiredListingPublic,
  now: () => new Date(),
};

export async function handlePublicVideoSignedUrl(
  _request: NextRequest,
  propertyId: string,
  deps: PublicVideoRouteDeps = defaultDeps
) {
  if (!deps.hasServerSupabaseEnv() || !deps.hasServiceRoleEnv()) {
    return NextResponse.json(
      {
        error:
          "Video playback is unavailable because storage is not configured.",
        code: "VIDEO_BUCKET_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  const serverClient = await deps.createServerSupabaseClient();
  const adminClient = deps.createServiceRoleClient();

  let viewerId: string | null = null;
  let viewerRole: UserRole | null = null;
  try {
    const {
      data: { user },
    } = await serverClient.auth.getUser();
    if (user?.id) {
      viewerId = user.id;
      viewerRole = normalizeRole(await deps.getUserRole(serverClient, user.id));
    }
  } catch {
    viewerId = null;
    viewerRole = null;
  }

  const { data: propertyRow, error: propertyError } = await adminClient
    .from("properties")
    .select("id,owner_id,is_demo,is_approved,is_active,status,expires_at,expired_at")
    .eq("id", propertyId)
    .maybeSingle();
  const property = (propertyRow as PublicVideoPropertyRow | null) ?? null;

  if (propertyError || !property) {
    return NextResponse.json(
      { error: "Listing not found.", code: "not_found" },
      { status: 404 }
    );
  }

  const includeDemoListings = await deps.includeDemoListingsForViewerFromSettings({
    viewerRole,
    viewerId,
    ownerId: property.owner_id ?? null,
  });

  const now = deps.now();
  const showExpiredPublic = await deps.getAppSettingBool(
    "show_expired_listings_public",
    false
  );
  const isPublicActive = deps.isListingPubliclyVisible(
    property,
    now
  );
  const allowExpiredPublic = deps.canShowExpiredListingPublic(
    property,
    showExpiredPublic,
    now
  );
  const demoHidden = !!property.is_demo && !includeDemoListings;
  if (!(isPublicActive || allowExpiredPublic) || demoHidden) {
    return NextResponse.json(
      { error: "Listing video unavailable.", code: "video_not_available" },
      { status: 404 }
    );
  }

  const { data: videoRow, error: videoError } = await adminClient
    .from("property_videos")
    .select("storage_path")
    .eq("property_id", propertyId)
    .maybeSingle();
  const video = (videoRow as { storage_path?: string | null } | null) ?? null;

  if (videoError || !video?.storage_path) {
    return NextResponse.json(
      { error: "Listing video unavailable.", code: "VIDEO_NOT_FOUND" },
      { status: 404 }
    );
  }

  const signed = await adminClient.storage
    .from(VIDEO_STORAGE_BUCKET)
    .createSignedUrl(video.storage_path, SIGNED_VIDEO_URL_TTL_SECONDS);

  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      {
        error: signed.error?.message || "Unable to sign video URL.",
        code: "VIDEO_SIGN_ERROR",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    url: signed.data.signedUrl,
    expiresIn: SIGNED_VIDEO_URL_TTL_SECONDS,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handlePublicVideoSignedUrl(request, id);
}
