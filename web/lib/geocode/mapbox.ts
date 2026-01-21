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
type GeocodeOptions = {
  countryCode?: string | null;
  proximity?: { longitude: number; latitude: number } | null;
  bbox?: [number, number, number, number] | null;
};

export function sanitizeLabel(placeName: string): string {
  const noStreet = placeName.replace(/^[0-9]+\s*/i, "").trim();
  const cleaned = noStreet || placeName;
  return cleaned.split(",").map((part) => part.trim()).filter(Boolean).join(", ");
}

export async function geocodeMapbox(
  query: string,
  token: string,
  options: GeocodeOptions = {}
): Promise<GeocodeResult[]> {
  const keyBase = query.toLowerCase();
  const key = `${keyBase}|${options.countryCode ?? ""}|${options.proximity ? `${options.proximity.longitude},${options.proximity.latitude}` : ""}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.results;

  const params = new URLSearchParams({
    access_token: token,
    limit: "5",
    types: "place,locality,neighborhood,postcode",
  });
  if (options.countryCode) {
    params.set("country", options.countryCode.toLowerCase());
  }
  if (options.proximity) {
    params.set("proximity", `${options.proximity.longitude},${options.proximity.latitude}`);
  }
  if (options.bbox) {
    params.set("bbox", options.bbox.join(","));
  }

  const url = `${MAPBOX_URL}/${encodeURIComponent(query)}.json?${params.toString()}`;
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
