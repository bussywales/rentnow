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

export function getSiteUrl() {
  const envUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeBaseUrl(process.env.SITE_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL);
  if (envUrl) return envUrl;

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
    // headers() can throw during build-time execution; fall through to empty string.
  }

  // Hard fallback to production host to avoid empty base URLs in server fetches.
  return "https://www.rentnow.space";
}
