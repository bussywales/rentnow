import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: Parameters<typeof response.cookies.set>[2]) {
        response.cookies.set(name, value, options);
      },
      remove(name: string, options: Parameters<typeof response.cookies.set>[2]) {
        response.cookies.set(name, "", { ...options, maxAge: 0 });
      },
    },
    headers: {
      get(name: string) {
        return request.headers.get(name) ?? undefined;
      },
    },
  });

  // Refresh the session if needed and propagate cookies to the response
  await supabase.auth.getSession();
  return response;
}
