import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  applyServerAuthCookieDefaults,
  buildClientCookieOptions,
  shouldMirrorClientCookie,
} from "@/lib/auth/server-cookie";
import { serializeCookie } from "@/lib/auth/cookie-serialize";
import {
  logSuppressedAuthCookieClear,
  shouldSuppressAuthCookieClear,
  shouldLogCookieDebug,
} from "@/lib/auth/cookie-guard";

function normalizeRedirect(value: FormDataEntryValue | null) {
  const fallback = "/dashboard";
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  return trimmed;
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const redirectTo = normalizeRedirect(formData.get("redirect"));
  const baseUrl = new URL(request.url);

  const errorRedirect = (message: string) => {
    const url = new URL("/auth/login", baseUrl);
    url.searchParams.set("error", message);
    url.searchParams.set("redirect", redirectTo);
    return NextResponse.redirect(url, 303);
  };

  if (!email || !password) {
    return errorRedirect("Email and password are required.");
  }

  const env = getSupabaseEnv();
  if (!env) {
    return errorRedirect("Supabase environment variables are missing.");
  }

  const response = NextResponse.redirect(new URL(redirectTo, baseUrl), 303);
  const hostOnlyCookies: Array<{
    name: string;
    value: string;
    options: ReturnType<typeof buildClientCookieOptions>;
  }> = [];

  const debug = shouldLogCookieDebug(
    request.nextUrl.searchParams.get("debug") === "1"
  );

  const supabase = createServerClient(env.url, env.anonKey, {
    cookieEncoding: "base64url",
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          if (shouldSuppressAuthCookieClear(name, options, value)) {
            logSuppressedAuthCookieClear({
              route: request.nextUrl.pathname,
              cookieName: name,
              source: "login-setAll",
              debug,
            });
            return;
          }
          const mergedOptions = applyServerAuthCookieDefaults(
            name,
            options,
            request
          );
          response.cookies.set(name, value, mergedOptions);
          if (shouldMirrorClientCookie(name)) {
            hostOnlyCookies.push({
              name,
              value,
              options: buildClientCookieOptions(mergedOptions),
            });
          }
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return errorRedirect(
      error?.message || "Unable to log in. Please try again."
    );
  }

  hostOnlyCookies.forEach(({ name, value, options }) => {
    response.headers.append("set-cookie", serializeCookie(name, value, options));
  });

  return response;
}
