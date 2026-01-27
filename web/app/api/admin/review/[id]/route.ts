import { NextResponse } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  ADMIN_REVIEW_DETAIL_SELECT,
  ADMIN_REVIEW_IMAGE_SELECT,
  ADMIN_REVIEW_VIDEO_SELECT,
  ADMIN_REVIEW_VIEW_TABLE,
  normalizeSelect,
} from "@/lib/admin/admin-review-contracts";
import { assertNoForbiddenColumns } from "@/lib/admin/admin-review-schema-allowlist";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }
  const { id } = await context.params;
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;

  const detailSelect = normalizeSelect(ADMIN_REVIEW_DETAIL_SELECT);
  const imageSelect = normalizeSelect(ADMIN_REVIEW_IMAGE_SELECT);
  const videoSelect = normalizeSelect(ADMIN_REVIEW_VIDEO_SELECT);

  assertNoForbiddenColumns(detailSelect, "admin review detail");
  assertNoForbiddenColumns(imageSelect, "admin review images");
  assertNoForbiddenColumns(videoSelect, "admin review videos");

  const [detailRes, imagesRes, videosRes] = await Promise.all([
    client.from(ADMIN_REVIEW_VIEW_TABLE).select(detailSelect).eq("id", id).maybeSingle(),
    client.from("property_images").select(imageSelect).eq("property_id", id).order("created_at", { ascending: true }),
    client.from("property_videos").select(videoSelect).eq("property_id", id).order("created_at", { ascending: true }),
  ]);

  if (detailRes.error) {
    return NextResponse.json({ error: detailRes.error.message }, { status: 400 });
  }
  if (!detailRes.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    listing: detailRes.data,
    images: imagesRes.data ?? [],
    videos: videosRes.data ?? [],
  });
}
