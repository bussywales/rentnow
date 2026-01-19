const MAPBOX_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

type GeocodeResult = {
  label: string;
  place_id: string;
  lat: number;
  lng: number;
  bbox?: [number, number, number, number];
  raw?: unknown;
};

const cache = new Map<string, { ts: number; results: GeocodeResult[] }>();
const CACHE_TTL_MS = 60_000;

export function sanitizeLabel(placeName: string): string {
  const noStreet = placeName.replace(/^[0-9]+\s*/i, "").trim();
  const cleaned = noStreet || placeName;
  return cleaned.split(",").map((part) => part.trim()).filter(Boolean).join(", ");
}

export async function geocodeMapbox(query: string, token: string): Promise<GeocodeResult[]> {
  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.results;

  const url = `${MAPBOX_URL}/${encodeURIComponent(query)}.json?access_token=${token}&limit=5&types=place,locality,neighborhood`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    features?: Array<{
      id: string;
      place_name: string;
      center: [number, number];
      bbox?: [number, number, number, number];
    }>;
  };
  const results: GeocodeResult[] =
    data.features?.map((f) => ({
      label: sanitizeLabel(f.place_name),
      place_id: f.id,
      lng: f.center?.[0],
      lat: f.center?.[1],
      bbox: f.bbox,
      raw: f,
    }))?.filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lng)) ?? [];
  cache.set(key, { ts: Date.now(), results });
  return results;
}
