import { headers } from "next/headers";

export const DEV_MOCKS =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_MOCKS === "true";

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

async function getHeaderBaseUrl() {
  try {
    const store = await headers();
    const host = store?.get?.("x-forwarded-host") || store?.get?.("host");
    const forwardedProto = store?.get?.("x-forwarded-proto");
    const proto =
      forwardedProto ||
      (host && (host.startsWith("localhost") || host.startsWith("127.0.0.1"))
        ? "http"
        : "https");
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  } catch {
    // headers() can throw during build-time execution; fall through to null.
  }

  return null;
}

export function getEnvPresence() {
  return {
    NEXT_PUBLIC_SITE_URL: !!process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_ENABLE_DEV_MOCKS: process.env.NEXT_PUBLIC_ENABLE_DEV_MOCKS === "true",
    SITE_URL: !!process.env.SITE_URL,
    VERCEL_URL: !!process.env.VERCEL_URL,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export async function getApiBaseUrl() {
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
    (await getHeaderBaseUrl()) ||
    ""
  );
}

export async function getSiteUrl(options?: { allowFallback?: boolean }) {
  const envUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeBaseUrl(process.env.SITE_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL);
  if (envUrl) return envUrl;

  const headerUrl = await getHeaderBaseUrl();
  if (headerUrl) return headerUrl;

  if (options?.allowFallback === false) return "";

  // Hard fallback to production host to avoid empty base URLs in server fetches.
  return "https://www.rentnow.space";
}

export async function getCanonicalBaseUrl() {
  const envUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (envUrl) return envUrl;

  const headerUrl = await getHeaderBaseUrl();
  if (headerUrl) return headerUrl;

  return "";
}
