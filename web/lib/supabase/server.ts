import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

type MockQueryResult = { data: unknown; error: Error | null };

const getEnv = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
};

function getProjectRef(url?: string) {
  if (!url) return null;
  const match = url.match(/https:\/\/(.*?)\.supabase\.co/);
  return match?.[1] || null;
}

type SessionTokens = { access_token: string; refresh_token: string };
type SupabaseBootstrapMeta = {
  cookieName: string | null;
  cookieFound: boolean;
  tokensFound: boolean;
  setSessionAttempted: boolean;
  setSessionError: string | null;
};

function readCookieValue(headerCookies: Map<string, string>, name: string | null) {
  if (!name) return undefined;
  return headerCookies.get(name);
}

function parseSupabaseAuthCookie(raw?: string | null): SessionTokens | null {
  if (!raw) return null;

  const tryDecode = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const candidates = [tryDecode(raw)];
  if (!candidates.includes(raw)) candidates.push(raw);

  for (const candidate of candidates) {
    try {
      // Supabase stores `{ currentSession, expiresAt }` in the auth cookie.
      const parsed = JSON.parse(candidate) as unknown;
      const base = Array.isArray(parsed) ? parsed[0] : parsed;
      const sessionSource =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (base as any)?.currentSession ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (base as any)?.session ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (base as any)?.data?.session ||
        base;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const access_token = (sessionSource as any)?.access_token;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refresh_token = (sessionSource as any)?.refresh_token;

      if (access_token && refresh_token) {
        return { access_token, refresh_token };
      }
    } catch {
      /* ignore parse failures */
    }
  }

  return null;
}

export function hasServerSupabaseEnv() {
  return !!getEnv();
}

function createMockSupabaseClient() {
  const mockResult: MockQueryResult = { data: null, error: new Error("Supabase not configured") };

  const builder: Record<string, unknown> & {
    select: () => typeof builder;
    eq: () => typeof builder;
    gte: () => typeof builder;
    lte: () => typeof builder;
    ilike: () => typeof builder;
    contains: () => typeof builder;
    order: () => Promise<MockQueryResult>;
    maybeSingle: () => Promise<MockQueryResult>;
    single: () => Promise<MockQueryResult>;
    insert: () => Promise<MockQueryResult>;
    update: () => Promise<MockQueryResult>;
    delete: () => Promise<MockQueryResult>;
    upsert: () => Promise<MockQueryResult>;
  } = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    ilike: () => builder,
    contains: () => builder,
    order: async () => mockResult,
    maybeSingle: async () => mockResult,
    single: async () => mockResult,
    insert: async () => mockResult,
    update: async () => mockResult,
    delete: async () => mockResult,
    upsert: async () => mockResult,
  };

  const mockClient = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => builder,
    storage: {
      from: () => ({
        upload: async () => ({ error: new Error("Supabase not configured") }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  };

  return mockClient as ReturnType<typeof createServerClient>;
}

export function createServerSupabaseClient() {
  const env = getEnv();
  if (!env) {
    console.warn("Supabase env vars missing; using mock client");
    return createMockSupabaseClient();
  }

  const { url, anonKey } = env;
  const projectRef = getProjectRef(url);
  const cookieName = projectRef ? `sb-${projectRef}-auth-token` : null;
  const headerCookieMap = (() => {
    const map = new Map<string, string>();
    try {
      const rawHeaders = headers();
      const raw =
        (rawHeaders as unknown as { get?: (name: string) => string | null })?.get?.("cookie") ??
        null;
      if (!raw) return map;
      raw.split(";").forEach((pair) => {
        const [k, ...rest] = pair.split("=");
        const key = k?.trim();
        if (!key) return;
        const value = rest.join("=").trim();
        if (value) map.set(key, value);
      });
    } catch {
      /* ignore */
    }
    return map;
  })();

  const client = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return readCookieValue(headerCookieMap, name) as string | undefined;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          const store = cookies() as unknown as {
            set?: (opts: CookieOptions & { name: string; value: string }) => void;
          };
          store?.set?.({ name, value, ...options });
        } catch {
          /* no-op on read-only cookie store */
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          const store = cookies() as unknown as {
            set?: (opts: CookieOptions & { name: string; value: string }) => void;
          };
          store?.set?.({ name, value: "", ...options, maxAge: 0 });
        } catch {
          /* no-op */
        }
      },
    },
  });

  const authCookie = readCookieValue(headerCookieMap, cookieName);
  const tokens = parseSupabaseAuthCookie(authCookie);
  const setSession =
    tokens &&
    (client.auth as {
      setSession?: (
        t: SessionTokens,
      ) => Promise<{ error?: { message?: string } | null }>;
    }).setSession;
  const bootstrap: SupabaseBootstrapMeta = {
    cookieName,
    cookieFound: !!authCookie,
    tokensFound: !!tokens,
    setSessionAttempted: !!setSession,
    setSessionError: null,
  };

  const setSessionPromise =
    tokens && setSession
      ? setSession(tokens)
          .then((result) => {
            if (result?.error) {
              bootstrap.setSessionError =
                result.error.message || "Unknown Supabase auth error";
            }
          })
          .catch((err: unknown) => {
            bootstrap.setSessionError =
              err instanceof Error ? err.message : "Failed to set Supabase session";
          })
      : null;

  if (setSessionPromise) {
    const baseGetSession = client.auth.getSession.bind(client.auth);
    const baseGetUser = client.auth.getUser.bind(client.auth);

    client.auth.getSession = async (...args: Parameters<typeof baseGetSession>) => {
      await setSessionPromise;
      return baseGetSession(...args);
    };

    client.auth.getUser = async (...args: Parameters<typeof baseGetUser>) => {
      await setSessionPromise;
      return baseGetUser(...args);
    };
  }

  (client as unknown as { __bootstrap?: SupabaseBootstrapMeta }).__bootstrap = bootstrap;

  if (tokens && !setSession && !bootstrap.setSessionError) {
    bootstrap.setSessionError = "Supabase client missing setSession helper";
  }

  if (bootstrap.setSessionError) {
    console.warn("Supabase session bootstrap failed", bootstrap.setSessionError);
  }

  return client;
}
