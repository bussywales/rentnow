import { headers } from "next/headers";

function normalizeBaseUrl(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

let loggedMissingPublicSiteUrl = false;

function getHeaderBaseUrl() {
  try {
    const headerStore = headers();
    const maybeThen = (headerStore as unknown as { then?: unknown })?.then;
    const store =
      typeof maybeThen === "function"
        ? null
        : (headerStore as unknown as { get?: (key: string) => string | null });

    const host = store?.get?.("x-forwarded-host") || store?.get?.("host");
    const proto = store?.get?.("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  } catch {
    // headers() can throw during build-time execution; fall through to null.
  }

  return null;
}

export function getEnvPresence() {
  return {
    NEXT_PUBLIC_SITE_URL: !!process.env.NEXT_PUBLIC_SITE_URL,
    SITE_URL: !!process.env.SITE_URL,
    VERCEL_URL: !!process.env.VERCEL_URL,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getApiBaseUrl() {
  const envUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (envUrl) return envUrl;

  if (process.env.NODE_ENV === "production") {
    if (!loggedMissingPublicSiteUrl) {
      console.error(
        "[env] NEXT_PUBLIC_SITE_URL is missing in production; set it to https://www.rentnow.space. Falling back to relative API URLs."
      );
      loggedMissingPublicSiteUrl = true;
    }
    return "";
  }

  return (
    normalizeBaseUrl(process.env.SITE_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL) ||
    getHeaderBaseUrl() ||
    ""
  );
}

export function getSiteUrl() {
  const envUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeBaseUrl(process.env.SITE_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL);
  if (envUrl) return envUrl;

  const headerUrl = getHeaderBaseUrl();
  if (headerUrl) return headerUrl;

  // Hard fallback to production host to avoid empty base URLs in server fetches.
  return "https://www.rentnow.space";
}
