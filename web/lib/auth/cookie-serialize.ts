type CookieOptions = {
  domain?: string;
  path?: string;
  sameSite?: "lax" | "strict" | "none" | boolean;
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
  expires?: Date | string;
};

function formatSameSite(value?: CookieOptions["sameSite"]) {
  if (value === true) return "Strict";
  if (value === false || typeof value === "undefined") return "Lax";
  return value[0].toUpperCase() + value.slice(1);
}

function formatExpires(value?: Date | string) {
  if (!value) return null;
  if (value instanceof Date) return value.toUTCString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toUTCString();
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
) {
  const parts = [`${name}=${value}`];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  parts.push(`Path=${options.path ?? "/"}`);
  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  const expires = formatExpires(options.expires);
  if (expires) parts.push(`Expires=${expires}`);
  if (options.secure) parts.push("Secure");
  if (options.httpOnly) parts.push("HttpOnly");
  const sameSite = formatSameSite(options.sameSite);
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  return parts.join("; ");
}
