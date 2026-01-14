import { headers } from "next/headers";

type AuthRedirectMeta = {
  pathname: string;
  reason: "auth";
  host: string | null;
  userAgent: string | null;
  requestId: string | null;
};

function readHeader(store: Headers, key: string) {
  const value = store.get(key);
  return value ? value.trim() : null;
}

export function logAuthRedirect(pathname: string) {
  try {
    const store = headers();
    if (store && typeof (store as Promise<Headers>).then === "function") {
      return;
    }
    const headerStore = store as unknown as Headers;
    const host =
      readHeader(headerStore, "x-forwarded-host") || readHeader(headerStore, "host");
    const userAgent = readHeader(headerStore, "user-agent");
    const requestId =
      readHeader(headerStore, "x-request-id") ||
      readHeader(headerStore, "x-vercel-id");
    const payload: AuthRedirectMeta = {
      pathname,
      reason: "auth",
      host,
      userAgent,
      requestId,
    };
    console.warn("Auth redirect", payload);
  } catch {
    // Swallow logging errors to avoid breaking redirects.
  }
}
