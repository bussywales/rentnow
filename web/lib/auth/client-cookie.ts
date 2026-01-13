type AuthSession = {
  access_token: string;
  refresh_token: string;
};

type SameSitePolicy = "lax" | "strict" | "none";

export type AuthCookieOptions = {
  name?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  sameSite?: SameSitePolicy;
  maxAge?: number;
  format?: "base64" | "json";
};

const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "supabase";
  const match = url.match(/https:\/\/(.*?)\.supabase\.co/);
  return match?.[1] ?? "supabase";
}

function resolveAuthCookieName(options?: AuthCookieOptions) {
  if (options?.name) return options.name;
  return `sb-${getProjectRef()}-auth-token`;
}

function encodeBase64(input: string): string | null {
  try {
    if (typeof btoa === "function" && typeof TextEncoder !== "undefined") {
      const bytes = new TextEncoder().encode(input);
      let binary = "";
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }
      return btoa(binary);
    }
  } catch {
    // fall through
  }

  try {
    const buffer = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } })
      .Buffer;
    if (buffer?.from) {
      return buffer.from(input, "utf-8").toString("base64");
    }
  } catch {
    // fall through
  }

  return null;
}

function encodeBase64Url(input: string): string | null {
  const encoded = encodeBase64(input);
  if (!encoded) return null;
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSessionValue(session: AuthSession, format: "base64" | "json") {
  const payload = JSON.stringify(session);
  if (format === "json") {
    return encodeURIComponent(payload);
  }
  const base64 = encodeBase64Url(payload);
  if (!base64) return encodeURIComponent(payload);
  return `base64-${base64}`;
}

function resolveSecureFlag(options?: AuthCookieOptions) {
  if (typeof options?.secure === "boolean") return options.secure;
  if (process.env.NODE_ENV !== "production") return false;
  if (typeof window === "undefined") return true;
  return window.location.protocol === "https:";
}

function buildCookieString(
  name: string,
  value: string,
  options: AuthCookieOptions
) {
  const parts = [`${name}=${value}`];
  parts.push(`path=${options.path ?? "/"}`);
  const secure = resolveSecureFlag(options);
  if (typeof options.maxAge === "number") {
    parts.push(`max-age=${options.maxAge}`);
  }
  if (options.domain) {
    parts.push(`domain=${options.domain}`);
  }
  const sameSite = options.sameSite ?? "lax";
  parts.push(`samesite=${sameSite}`);
  if (secure) {
    parts.push("secure");
  }
  return parts.join("; ");
}

export function writeSupabaseAuthCookie(
  session: AuthSession | null,
  cookieOptions?: AuthCookieOptions
) {
  if (typeof document === "undefined") return;
  const resolvedOptions = cookieOptions ?? {};
  const name = resolveAuthCookieName(resolvedOptions);
  if (!name) return;

  if (!session) {
    document.cookie = buildCookieString(name, "", {
      ...resolvedOptions,
      maxAge: 0,
    });
    return;
  }

  if (!session.access_token || !session.refresh_token) return;

  const format = resolvedOptions.format ?? "base64";
  const value = encodeSessionValue(session, format);
  const maxAge = resolvedOptions.maxAge ?? DEFAULT_MAX_AGE_SECONDS;

  document.cookie = buildCookieString(name, value, {
    ...resolvedOptions,
    maxAge,
  });
}
