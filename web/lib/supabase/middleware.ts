import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  logSuppressedAuthCookieClear,
  shouldSuppressAuthCookieClear,
  shouldLogCookieDebug,
} from "@/lib/auth/cookie-guard";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh the session if needed and propagate cookies to the response
  await supabase.auth.getSession();
  return response;
}
