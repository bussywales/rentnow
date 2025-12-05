import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
    cookieEncoding: "base64url",
    cookies: {
      getAll: async () => {
        try {
          return cookieStore.getAll();
        } catch {
          return [];
        }
      },
      setAll: async (cookies) => {
        try {
          cookies.forEach(({ name, value, options }) =>
            cookieStore.set({ name, value, ...options })
          );
        } catch {
          /* ignore write failures */
        }
      },
    },
  });
}
