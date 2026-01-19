export function buildStaticMapUrl({
  lat,
  lng,
  zoom = 12,
  width = 600,
  height = 240,
}: {
  lat: number;
  lng: number;
  zoom?: number;
  width?: number;
  height?: number;
}): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const safeWidth = Math.min(Math.max(Math.floor(width), 100), 1280);
  const safeHeight = Math.min(Math.max(Math.floor(height), 100), 1280);
  const marker = `pin-s+2850ff(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${marker}/${lng},${lat},${zoom}/${safeWidth}x${safeHeight}@2x?access_token=${token}`;
}
