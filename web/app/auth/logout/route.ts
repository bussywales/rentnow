import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  applyServerAuthCookieDefaults,
  buildClientCookieOptions,
  shouldMirrorClientCookie,
} from "@/lib/auth/server-cookie";
import { serializeCookie } from "@/lib/auth/cookie-serialize";
import { isAuthCookieName } from "@/lib/auth/cookie-guard";

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export async function POST(request: NextRequest) {
  const url = new URL("/", request.url);
  const response = NextResponse.redirect(url, 303);
  const hostOnlyCookies: Array<{
    name: string;
    value: string;
    options: ReturnType<typeof buildClientCookieOptions>;
  }> = [];

  const env = getSupabaseEnv();
  if (env) {
    try {
      const supabase = createServerClient(env.url, env.anonKey, {
        cookieEncoding: "base64url",
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookies) {
            cookies.forEach(({ name, value, options }) => {
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
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Logout error", err);
    }
  }

  if (!env) {
    request.cookies.getAll().forEach((cookie) => {
      if (!isAuthCookieName(cookie.name)) return;
      const mergedOptions = applyServerAuthCookieDefaults(cookie.name, {
        maxAge: 0,
      }, request);
      response.cookies.set(cookie.name, "", mergedOptions);
      if (shouldMirrorClientCookie(cookie.name)) {
        hostOnlyCookies.push({
          name: cookie.name,
          value: "",
          options: buildClientCookieOptions({
            ...mergedOptions,
            maxAge: 0,
          }),
        });
      }
    });
  }

  hostOnlyCookies.forEach(({ name, value, options }) => {
    response.headers.append("set-cookie", serializeCookie(name, value, options));
  });

  return response;
}
