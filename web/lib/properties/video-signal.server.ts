import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { Property } from "@/lib/types";

type PropertyVideoRecord = NonNullable<Property["property_videos"]>[number];

function isPropertyVideoRecord(value: unknown): value is PropertyVideoRecord {
  return typeof value === "object" && value !== null;
}

export function normalizePropertyVideoRecords(value: unknown): Property["property_videos"] {
  if (Array.isArray(value)) {
    const records = value.filter(isPropertyVideoRecord) as PropertyVideoRecord[];
    return records.length > 0 ? records : [];
  }
  if (isPropertyVideoRecord(value)) {
    return [value];
  }
  return null;
}

export function hasPropertyVideoRecords(value: unknown): boolean {
  const records = normalizePropertyVideoRecords(value);
  if (!records?.length) return false;

  return records.some((record) => {
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const url = typeof record.video_url === "string" ? record.video_url.trim() : "";
    const path = typeof record.storage_path === "string" ? record.storage_path.trim() : "";
    return id.length > 0 || url.length > 0 || path.length > 0;
  });
}

export function resolvePropertyHasVideoSignal(input: {
  hasVideo?: boolean | null;
  propertyVideos?: unknown;
  featuredMedia?: Property["featured_media"] | null;
  allowFeaturedMediaFallback?: boolean;
}): boolean {
  if (input.hasVideo === true) return true;
  if (input.hasVideo === false) return false;
  if (hasPropertyVideoRecords(input.propertyVideos)) return true;
  if (input.allowFeaturedMediaFallback) {
    return input.featuredMedia === "video";
  }
  return false;
}

export async function probePropertyHasVideo(propertyId: string): Promise<boolean | null> {
  const normalizedId = String(propertyId || "").trim();
  if (!normalizedId || !hasServiceRoleEnv()) return null;

  const adminClient = createServiceRoleClient();
  const { data, error } = await adminClient
    .from("property_videos")
    .select("id")
    .eq("property_id", normalizedId)
    .limit(1);

  if (error) return null;
  return Array.isArray(data) && data.length > 0;
}
