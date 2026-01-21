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

const trimOrNull = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toComparable = (value: string | null) => value?.trim().toLowerCase() ?? "";

export function sanitizePostalCode(
  countryCode: string | null | undefined,
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const firstToken = raw.split(",")[0] ?? "";
  const collapsed = firstToken.trim().replace(/\s+/g, " ");
  if (!collapsed) return null;
  const upper = collapsed.toUpperCase();
  const country = (countryCode || "").toUpperCase();

  if (country === "GB") {
    const match = upper.replace(/\s+/g, "").match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
    if (match) return `${match[1]} ${match[2]}`;
    return upper;
  }
  if (country === "CA") {
    const compact = upper.replace(/\s+/g, "");
    const caMatch = compact.match(/^([A-Z]\d[A-Z])(\d[A-Z]\d)$/);
    if (caMatch) return `${caMatch[1]} ${caMatch[2]}`;
    return upper;
  }
  if (country === "US") {
    const usMatch = collapsed.match(/^\d{5}(?:-\d{4})?$/);
    if (usMatch) return usMatch[0];
  }
  return collapsed;
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

  const country_code = trimOrNull((country?.short_code || country?.id || "").split("-")[0]?.toUpperCase() || null);

  const regionText = trimOrNull(region?.text || null);
  const districtText = trimOrNull(district?.text || null);
  const placeText = trimOrNull(place?.text || null);
  const localityText = trimOrNull(locality?.text || null);
  const neighborhoodText = trimOrNull(neighborhood?.text || null);
  const countryText = trimOrNull(country?.text || null);
  const featureText = trimOrNull(feature.text || null);
  const labelText = trimOrNull((feature.place_name || feature.text || "").split(",")[0] || null);

  const admin_area_1 = trimOrNull(regionText || placeText || null);

  const city =
    trimOrNull(placeText || null) ??
    trimOrNull(localityText || null) ??
    trimOrNull(districtText || null);

  let admin_area_2: string | null = null;
  if (districtText && districtText !== admin_area_1) {
    admin_area_2 = districtText;
  } else if (regionText && regionText !== admin_area_1) {
    admin_area_2 = regionText;
  } else if (
    placeText &&
    placeText !== admin_area_1 &&
    placeText !== city &&
    placeText !== countryText
  ) {
    admin_area_2 = placeText;
  }
  if (admin_area_2 && countryText && toComparable(admin_area_2) === toComparable(countryText)) {
    admin_area_2 = null;
  }
  if (country_code === "GB" && admin_area_2 && toComparable(admin_area_2) === "united kingdom") {
    admin_area_2 = null;
  }

  const neighbourhoodCandidates = [
    labelText,
    featureText,
    neighborhoodText,
    localityText,
    placeText && placeText !== city ? placeText : null,
    districtText,
  ].filter(Boolean) as string[];
  const chosenNeighbourhood =
    neighbourhoodCandidates.find((candidate) => {
      const comparable = toComparable(candidate);
      if (comparable === toComparable(city)) return false;
      if (comparable === toComparable(admin_area_1)) return false;
      if (comparable === toComparable(admin_area_2)) return false;
      return true;
    }) || null;

  return {
    label: trimOrNull(feature.place_name || feature.text || null),
    place_id: trimOrNull(feature.id || feature.place_name || null),
    country_code,
    admin_area_1,
    admin_area_2,
    locality: city,
    sublocality: chosenNeighbourhood,
    postal_code: sanitizePostalCode(country_code, postcode?.text ?? null),
  };
}
