/**
 * Resolve the video storage bucket name.
 * Server can override with SUPABASE_VIDEO_STORAGE_BUCKET; client uses NEXT_PUBLIC_SUPABASE_VIDEO_STORAGE_BUCKET.
 */
export function resolveVideoBucket() {
  if (typeof process !== "undefined") {
    const server = (process.env as Record<string, string | undefined>).SUPABASE_VIDEO_STORAGE_BUCKET;
    if (server) return server;
  }
  const client =
    (typeof process !== "undefined"
      ? (process.env as Record<string, string | undefined>)
          .NEXT_PUBLIC_SUPABASE_VIDEO_STORAGE_BUCKET
      : undefined) || "property-videos";
  return client;
}

export const VIDEO_STORAGE_BUCKET = resolveVideoBucket();

export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const ALLOWED_VIDEO_TYPES = ["video/mp4"];

export function isAllowedVideoType(type: string | null | undefined): boolean {
  if (!type) return false;
  const normalized = type.toLowerCase();
  return ALLOWED_VIDEO_TYPES.includes(normalized) || normalized === "application/mp4";
}

export function isAllowedVideoSize(size: number): boolean {
  return Number.isFinite(size) && size <= MAX_VIDEO_BYTES;
}

export function videoExtensionForType(): string {
  return "mp4";
}
