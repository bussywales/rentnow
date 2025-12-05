import { cookies } from "next/headers";
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

type CookieStore = Awaited<ReturnType<typeof cookies>>;

async function getCookieStore(): Promise<CookieStore> {
  const store = cookies();
  return store instanceof Promise ? await store : store;
}

export async function createServerSupabaseClient() {
  const env = getEnv();
  if (!env) {
    throw new Error("Supabase env vars missing");
  }

  const cookieStore = await getCookieStore();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      get(name: string) {
        try {
          return cookieStore.get(name)?.value;
        } catch {
          return undefined;
        }
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          /* ignore write failures */
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          /* ignore write failures */
        }
      },
    },
  });
}
