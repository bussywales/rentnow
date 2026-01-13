import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  logSuppressedAuthCookieClear,
  shouldSuppressAuthCookieClear,
  shouldLogCookieDebug,
} from "@/lib/auth/cookie-guard";
import {
  applyServerAuthCookieDefaults,
  buildClientCookieOptions,
  shouldMirrorClientCookie,
} from "@/lib/auth/server-cookie";
import { serializeCookie } from "@/lib/auth/cookie-serialize";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  const hostOnlyCookies: Array<{
    name: string;
    value: string;
    options: ReturnType<typeof buildClientCookieOptions>;
  }> = [];

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const debug = shouldLogCookieDebug(
    request.nextUrl.searchParams.get("debug") === "1"
  );

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
              source: "middleware-setAll",
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

  // Refresh the session if needed and propagate cookies to the response
  await supabase.auth.getSession();
  hostOnlyCookies.forEach(({ name, value, options }) => {
    response.headers.append(
      "set-cookie",
      serializeCookie(name, value, options)
    );
  });
  return response;
}
