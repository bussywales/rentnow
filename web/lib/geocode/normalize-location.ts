export type MapboxContext = { id?: string; text?: string; short_code?: string };

export type MapboxFeature = {
  id?: string;
  place_name?: string;
  text?: string;
  place_type?: string[];
  center?: [number, number];
  context?: MapboxContext[];
};

function findContext(context: MapboxContext[] | undefined, prefix: string) {
  return context?.find((c) => (c.id ?? "").startsWith(prefix));
}

export type NormalizedLocation = {
  label: string | null;
  place_id: string | null;
  country_code: string | null;
  admin_area_1: string | null;
  admin_area_2: string | null;
  locality: string | null;
  sublocality: string | null;
  postal_code: string | null;
};

export function normalizeMapboxFeature(feature: MapboxFeature | null): NormalizedLocation {
  const empty: NormalizedLocation = {
    label: null,
    place_id: null,
    country_code: null,
    admin_area_1: null,
    admin_area_2: null,
    locality: null,
    sublocality: null,
    postal_code: null,
  };
  if (!feature) return empty;

  const context = feature.context || [];
  const country = findContext(context, "country");
  const region = findContext(context, "region");
  const district = findContext(context, "district");
  const place = findContext(context, "place");
  const locality = findContext(context, "locality");
  const neighborhood = findContext(context, "neighborhood");
  const postcode = findContext(context, "postcode");

  const trimOrNull = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const country_code = trimOrNull((country?.short_code || country?.id || "").split("-")[0]?.toUpperCase() || null);

  // Priority rules (global-safe):
  // admin_area_1: region > place (as fallback)
  const admin_area_1 = trimOrNull(region?.text || place?.text || null);
  // admin_area_2: district > locality > place (only if different from admin_area_1)
  const rawAdmin2 = trimOrNull(district?.text || locality?.text || place?.text || null);
  const admin_area_2 = rawAdmin2 && rawAdmin2 !== admin_area_1 ? rawAdmin2 : null;

  const localityValue = trimOrNull(place?.text || null);
  const sublocality =
    trimOrNull(neighborhood?.text || locality?.text || null) || null;

  return {
    label: trimOrNull(feature.place_name || feature.text || null),
    place_id: trimOrNull(feature.id || feature.place_name || null),
    country_code,
    admin_area_1,
    admin_area_2,
    locality: localityValue,
    sublocality,
    postal_code: trimOrNull(postcode?.text || null),
  };
}
