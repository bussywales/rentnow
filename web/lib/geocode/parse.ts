export type ParsedFeature = {
  label: string;
  place_id: string;
  lat: number;
  lng: number;
  country_code?: string | null;
  region_name?: string | null;
  place_name?: string | null;
  neighborhood_name?: string | null;
};

type MapboxContext = { id?: string; text?: string; short_code?: string };

type MapboxFeature = {
  id?: string;
  place_name?: string;
  center?: [number, number];
  context?: MapboxContext[];
  properties?: Record<string, unknown> & {
    short_code?: string;
    address?: string;
    category?: string;
  };
};

function findContext(context: MapboxContext[] | undefined, prefix: string) {
  return context?.find((c) => (c.id ?? "").startsWith(prefix));
}

export function parseMapboxFeature(
  feature: MapboxFeature,
  sanitizedLabel: string
): ParsedFeature | null {
  if (!feature || !Array.isArray(feature.center) || feature.center.length < 2) return null;
  const [lng, lat] = feature.center;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const context = feature.context || [];
  const country = findContext(context, "country");
  const region = findContext(context, "region");
  const place = findContext(context, "place") || findContext(context, "district");
  const neighborhood = findContext(context, "neighborhood") || findContext(context, "locality");

  return {
    label: sanitizedLabel,
    place_id: feature.id || sanitizedLabel,
    lat,
    lng,
    country_code: (country?.short_code || country?.id || "").split("-")[0] || null,
    region_name: region?.text || null,
    place_name: place?.text || null,
    neighborhood_name: neighborhood?.text || null,
  };
}
