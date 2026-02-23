const LEGACY_ROOT_HOST = "propatyhub.com";
const CANONICAL_HOST = "www.propatyhub.com";

export function resolveWwwCanonicalRedirect(
  requestUrl: URL,
  runtimeEnv: string = process.env.NODE_ENV ?? ""
): URL | null {
  const hostname = requestUrl.hostname.toLowerCase();
  if (runtimeEnv === "development") {
    return null;
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return null;
  }

  if (hostname !== LEGACY_ROOT_HOST) {
    return null;
  }

  const canonical = new URL(requestUrl.toString());
  canonical.protocol = "https:";
  canonical.host = CANONICAL_HOST;
  canonical.port = "";
  return canonical;
}
