import { cookies, headers } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const getEnv = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

export function hasServerSupabaseEnv() {
  return !!getEnv();
}

export function createServerSupabaseClient() {
  const env = getEnv();
  if (!env) {
    throw new Error("Supabase env vars missing");
  }

  const cookieStore = cookies();
  const headersList = headers();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        try {
          return cookieStore.getAll();
        } catch {
          return [];
        }
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options as CookieOptions);
          } catch {
            /* ignore write failures */
          }
        });
      },
    },
    headers: {
      get(name: string) {
        return headersList.get(name) ?? undefined;
      },
    },
  });
}
