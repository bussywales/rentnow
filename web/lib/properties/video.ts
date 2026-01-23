export const VIDEO_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET || "property-videos";

export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];

export function isAllowedVideoType(type: string | null | undefined): boolean {
  if (!type) return false;
  return ALLOWED_VIDEO_TYPES.includes(type.toLowerCase());
}

export function isAllowedVideoSize(size: number): boolean {
  return Number.isFinite(size) && size <= MAX_VIDEO_BYTES;
}

export function videoExtensionForType(type: string | null | undefined): string {
  if (!type) return "mp4";
  if (type.toLowerCase() === "video/quicktime") return "mov";
  return "mp4";
}
