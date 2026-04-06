export const ANALYTICS_ATTRIBUTION_COOKIE_NAME = "ph_attribution";
const ANALYTICS_ATTRIBUTION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type AnalyticsAttribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_path: string | null;
  captured_at: string | null;
  referrer: string | null;
};

const EMPTY_ATTRIBUTION: AnalyticsAttribution = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  landing_path: null,
  captured_at: null,
  referrer: null,
};

function cleanAttributionValue(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, 255) : null;
}

export function parseAnalyticsAttributionCookie(
  raw: string | null | undefined
): AnalyticsAttribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AnalyticsAttribution>;
    return {
      utm_source: cleanAttributionValue(parsed.utm_source),
      utm_medium: cleanAttributionValue(parsed.utm_medium),
      utm_campaign: cleanAttributionValue(parsed.utm_campaign),
      utm_content: cleanAttributionValue(parsed.utm_content),
      utm_term: cleanAttributionValue(parsed.utm_term),
      landing_path: cleanAttributionValue(parsed.landing_path),
      captured_at: cleanAttributionValue(parsed.captured_at),
      referrer: cleanAttributionValue(parsed.referrer),
    };
  } catch {
    return null;
  }
}

export function serializeAnalyticsAttributionCookie(value: AnalyticsAttribution) {
  return JSON.stringify(value);
}

export function extractAnalyticsAttribution(searchParams: URLSearchParams): AnalyticsAttribution | null {
  const utm_source = cleanAttributionValue(searchParams.get("utm_source"));
  const utm_medium = cleanAttributionValue(searchParams.get("utm_medium"));
  const utm_campaign = cleanAttributionValue(searchParams.get("utm_campaign"));
  const utm_content = cleanAttributionValue(searchParams.get("utm_content"));
  const utm_term = cleanAttributionValue(searchParams.get("utm_term"));

  if (!utm_source && !utm_medium && !utm_campaign && !utm_content && !utm_term) {
    return null;
  }

  return {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    landing_path: null,
    captured_at: null,
    referrer: null,
  };
}

export function mergeAnalyticsAttribution(input: {
  existing?: AnalyticsAttribution | null;
  incoming?: AnalyticsAttribution | null;
  landingPath?: string | null;
  capturedAt?: string | null;
  referrer?: string | null;
}): AnalyticsAttribution | null {
  const existing = input.existing ?? EMPTY_ATTRIBUTION;
  const incoming = input.incoming ?? EMPTY_ATTRIBUTION;
  const merged: AnalyticsAttribution = {
    utm_source: incoming.utm_source ?? existing.utm_source,
    utm_medium: incoming.utm_medium ?? existing.utm_medium,
    utm_campaign: incoming.utm_campaign ?? existing.utm_campaign,
    utm_content: incoming.utm_content ?? existing.utm_content,
    utm_term: incoming.utm_term ?? existing.utm_term,
    landing_path: cleanAttributionValue(input.landingPath) ?? existing.landing_path,
    captured_at: cleanAttributionValue(input.capturedAt) ?? existing.captured_at,
    referrer: cleanAttributionValue(input.referrer) ?? existing.referrer,
  };

  if (
    !merged.utm_source &&
    !merged.utm_medium &&
    !merged.utm_campaign &&
    !merged.utm_content &&
    !merged.utm_term &&
    !merged.landing_path
  ) {
    return null;
  }

  return merged;
}

function parseCookieValue(header: string | null, name: string) {
  if (!header) return null;
  const parts = header.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    const value = part.slice(name.length + 1);
    return value ? decodeURIComponent(value) : null;
  }
  return null;
}

export function readAnalyticsAttributionFromCookieHeader(header: string | null) {
  const raw = parseCookieValue(header, ANALYTICS_ATTRIBUTION_COOKIE_NAME);
  return parseAnalyticsAttributionCookie(raw);
}

export function buildAnalyticsAttributionCookieString(value: AnalyticsAttribution) {
  return `${ANALYTICS_ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent(
    serializeAnalyticsAttributionCookie(value)
  )}; Path=/; Max-Age=${ANALYTICS_ATTRIBUTION_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
