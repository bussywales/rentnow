import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const getEnv = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_ANON_KEY."
    );
  }

  return { url, anonKey };
};

export function createServerSupabaseClient() {
  const { url, anonKey } = getEnv();
  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        const store = cookieStore;
        const cookie = "then" in store ? undefined : store.get(name);
        return cookie?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        const store = cookieStore;
        if ("then" in store) return;
        store.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        const store = cookieStore;
        if ("then" in store) return;
        store.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });
}
