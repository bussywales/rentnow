const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type RawExif = {
  hasGps?: unknown;
  capturedAt?: unknown;
};

export type SanitizedExifMeta = {
  exif_has_gps: boolean | null;
  exif_captured_at: string | null;
};

export function sanitizeExifMeta(input?: RawExif | null): Partial<SanitizedExifMeta> {
  if (!input) return {};

  const cleanHasGps = (() => {
    if (typeof input.hasGps === "boolean") return input.hasGps;
    if (input.hasGps === "true") return true;
    if (input.hasGps === "false") return false;
    return null;
  })();

  const cleanCapturedAt = (() => {
    if (!input.capturedAt) return null;
    const asString = typeof input.capturedAt === "string" ? input.capturedAt : String(input.capturedAt);
    const parsed = Date.parse(asString);
    if (!Number.isFinite(parsed)) return null;
    const now = Date.now();
    if (parsed > now + ONE_DAY_MS) return null;
    return new Date(parsed).toISOString();
  })();

  const result: Partial<SanitizedExifMeta> = {};
  if (cleanHasGps !== undefined) result.exif_has_gps = cleanHasGps;
  if (cleanCapturedAt !== undefined) result.exif_captured_at = cleanCapturedAt;
  return result;
}
