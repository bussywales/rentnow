type CookieOptions = {
  maxAge?: number;
  expires?: Date | string;
};

const AUTH_COOKIE_PREFIX = "sb-";
const AUTH_COOKIE_MARKER = "auth-token";

export function isAuthCookieName(name: string) {
  return name.startsWith(AUTH_COOKIE_PREFIX) && name.includes(AUTH_COOKIE_MARKER);
}

function isCookieClear(options?: CookieOptions, value?: string) {
  if (options?.maxAge === 0) return true;
  if (value === "") return true;
  if (options?.expires) {
    const expires =
      options.expires instanceof Date
        ? options.expires
        : new Date(options.expires);
    if (!Number.isNaN(expires.getTime()) && expires.getTime() <= Date.now()) {
      return true;
    }
  }
  return false;
}

export function shouldSuppressAuthCookieClear(
  name: string,
  options?: CookieOptions,
  value?: string
) {
  if (!isAuthCookieName(name)) return false;
  return isCookieClear(options, value);
}

export function shouldLogCookieDebug(debug?: boolean) {
  return debug || process.env.NODE_ENV !== "production";
}

export function logSuppressedAuthCookieClear({
  route,
  cookieName,
  source,
  debug,
}: {
  route: string;
  cookieName: string;
  source: string;
  debug?: boolean;
}) {
  if (!shouldLogCookieDebug(debug)) return;
  console.warn("Auth cookie clear suppressed", {
    route,
    cookie: cookieName,
    source,
  });
}
