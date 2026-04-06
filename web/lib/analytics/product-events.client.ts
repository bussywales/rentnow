"use client";

import {
  normalizeProductAnalyticsProperties,
  type ProductAnalyticsEventName,
  type ProductAnalyticsEventProperties,
} from "@/lib/analytics/product-events";
import {
  ANALYTICS_ATTRIBUTION_COOKIE_NAME,
  buildAnalyticsAttributionCookieString,
  extractAnalyticsAttribution,
  mergeAnalyticsAttribution,
  parseAnalyticsAttributionCookie,
} from "@/lib/analytics/acquisition";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const PRODUCT_ANALYTICS_DEDUPE_KEY = "ph:analytics:product:dedupe:v1";

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const entries = document.cookie.split(";").map((part) => part.trim());
  for (const entry of entries) {
    if (!entry.startsWith(`${name}=`)) continue;
    return decodeURIComponent(entry.slice(name.length + 1));
  }
  return null;
}

export function persistAnalyticsAttributionFromLocation(locationHref = window.location.href) {
  if (typeof window === "undefined") return;
  const url = new URL(locationHref);
  const incoming = extractAnalyticsAttribution(url.searchParams);
  if (!incoming) return;
  const existing = parseAnalyticsAttributionCookie(getCookie(ANALYTICS_ATTRIBUTION_COOKIE_NAME));
  const merged = mergeAnalyticsAttribution({
    existing,
    incoming,
    landingPath: `${url.pathname}${url.search}`,
    capturedAt: new Date().toISOString(),
    referrer: document.referrer || null,
  });
  if (!merged) return;
  const cookieString = buildAnalyticsAttributionCookieString(merged);
  document.cookie =
    process.env.NODE_ENV === "production" ? `${cookieString}; Secure` : cookieString;
}

function markDedupeKey(key: string) {
  if (typeof window === "undefined") return false;
  try {
    const storage = window.sessionStorage;
    const current = storage.getItem(PRODUCT_ANALYTICS_DEDUPE_KEY);
    const parsed = current ? (JSON.parse(current) as string[]) : [];
    if (parsed.includes(key)) return true;
    storage.setItem(PRODUCT_ANALYTICS_DEDUPE_KEY, JSON.stringify([...parsed.slice(-49), key]));
    return false;
  } catch {
    return false;
  }
}

function buildEventBody(eventName: ProductAnalyticsEventName, properties?: ProductAnalyticsEventProperties) {
  return JSON.stringify({
    eventName,
    properties: normalizeProductAnalyticsProperties({
      ...properties,
      pagePath:
        properties?.pagePath ??
        (typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : undefined),
    }),
  });
}

function sendToGa(eventName: ProductAnalyticsEventName, properties?: ProductAnalyticsEventProperties) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const normalized = normalizeProductAnalyticsProperties(properties);
  const gaParams = Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== null && value !== undefined)
  );
  window.gtag("event", eventName, gaParams);
}

function logDebug(message: string, payload: unknown) {
  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG !== "true") return;
  console.info(`[analytics] ${message}`, payload);
}

export function trackProductEvent(
  eventName: ProductAnalyticsEventName,
  properties?: ProductAnalyticsEventProperties,
  options?: { dedupeKey?: string | null }
) {
  if (typeof window === "undefined") return;
  if (options?.dedupeKey && markDedupeKey(options.dedupeKey)) {
    return;
  }

  const body = buildEventBody(eventName, properties);
  logDebug(eventName, JSON.parse(body));
  sendToGa(eventName, properties);

  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/product", blob);
      return;
    }
  } catch {
    // fall through to fetch
  }

  void fetch("/api/analytics/product", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "include",
    keepalive: true,
  }).catch(() => undefined);
}

export function trackGaPageView(measurementId: string, input: { pagePath: string; pageTitle?: string | null }) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const params: Record<string, unknown> = {
    page_path: input.pagePath,
    page_location: `${window.location.origin}${input.pagePath}`,
  };
  if (input.pageTitle) {
    params.page_title = input.pageTitle;
  }
  window.gtag("event", "page_view", params);
  logDebug("page_view", { measurementId, ...params });
}
