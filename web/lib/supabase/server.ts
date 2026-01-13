import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { parseSupabaseAuthCookieValue } from "@/lib/auth/admin-session";
import {
  logSuppressedAuthCookieClear,
  shouldSuppressAuthCookieClear,
} from "@/lib/auth/cookie-guard";
import { applyServerAuthCookieDefaults } from "@/lib/auth/server-cookie";

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

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

export async function createServerSupabaseClient(options?: {
  allowCookieClear?: boolean;
  debugContext?: { route?: string };
}) {
  const env = getEnv();
  if (!env) {
    throw new Error("Supabase env vars missing");
  }

  const cookieStore = await getCookieStore();
  const allowCookieClear = options?.allowCookieClear ?? false;
  const debugRoute = options?.debugContext?.route ?? "server-client";

  return createServerClient(env.url, env.anonKey, {
    cookieEncoding: "base64url",
    cookies: {
      getAll: async () => {
        try {
          const allCookies = cookieStore.getAll();
          const authCookies = allCookies.filter((cookie) =>
            cookie.name.includes("auth-token")
          );
          if (authCookies.length <= 1) return allCookies;

          let bestCookie:
            | (typeof authCookies)[number]
            | null = null;
          let bestSession: ReturnType<typeof parseSupabaseAuthCookieValue> | null =
            null;
          let bestExpiry = -Infinity;

          for (const cookie of authCookies) {
            const session = parseSupabaseAuthCookieValue(cookie.value);
            if (!session) continue;
            const expiresAt =
              typeof session.expires_at === "number" ? session.expires_at : null;
            if (!bestCookie) {
              bestCookie = cookie;
              bestSession = session;
              bestExpiry = expiresAt ?? -Infinity;
              continue;
            }
            if (typeof expiresAt === "number" && expiresAt > bestExpiry) {
              bestCookie = cookie;
              bestSession = session;
              bestExpiry = expiresAt;
            }
          }

          if (!bestCookie || !bestSession) return allCookies;

          return [
            ...allCookies.filter(
              (cookie) => !cookie.name.includes("auth-token")
            ),
            {
              ...bestCookie,
              value: `base64-${encodeBase64Url(JSON.stringify(bestSession))}`,
            },
          ];
        } catch {
          return [];
        }
      },
      setAll: async (cookies) => {
        try {
          cookies.forEach(({ name, value, options }) => {
            if (
              !allowCookieClear &&
              shouldSuppressAuthCookieClear(name, options, value)
            ) {
              logSuppressedAuthCookieClear({
                route: debugRoute,
                cookieName: name,
                source: "server-setAll",
              });
              return;
            }
            const mergedOptions = applyServerAuthCookieDefaults(name, options);
            cookieStore.set({ name, value, ...mergedOptions });
          });
        } catch {
          /* ignore write failures */
        }
      },
    },
  });
}
