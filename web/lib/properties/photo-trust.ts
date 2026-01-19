type Recency = "recent" | "older" | "unknown";

export function derivePhotoTrust(
  images: Array<Partial<{ exif_has_gps: boolean | null; exif_captured_at: string | null }>>
) {
  const now = Date.now();
  const cutoff = now - 90 * 24 * 60 * 60 * 1000;
  const minDate = Date.parse("1995-01-01T00:00:00Z");
  const maxDate = now + 24 * 60 * 60 * 1000;

  let hasLocationMeta = false;
  let newestCaptured: number | null = null;

  images.forEach((img) => {
    const hasGps = (img as { exif_has_gps?: boolean | null }).exif_has_gps;
    const capturedAt = (img as { exif_captured_at?: string | null }).exif_captured_at;
    if (hasGps === true) {
      hasLocationMeta = true;
    }
    if (capturedAt) {
      const ts = Date.parse(capturedAt);
      if (!Number.isFinite(ts)) return;
      if (ts < minDate || ts > maxDate) return;
      if (newestCaptured === null || ts > newestCaptured) {
        newestCaptured = ts;
      }
    }
  });

  let recency: Recency = "unknown";
  if (newestCaptured !== null) {
    recency = newestCaptured >= cutoff ? "recent" : "older";
  }

  return {
    hasLocationMeta,
    recency,
    capturedAt: newestCaptured ? new Date(newestCaptured).toISOString() : undefined,
  };
}
