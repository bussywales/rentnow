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
    const host =
      headerStore.get("x-forwarded-host") ||
      headerStore.get("host");
    const proto = headerStore.get("x-forwarded-proto") || "https";
    if (host) {
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // headers() can throw during build-time execution; fall through to empty string.
  }

  return "";
}
