import { createBrowserClient, type CookieOptionsWithName } from "@supabase/ssr";

type MockQueryResult = { data: unknown; error: Error | null };

const getEnv = () => {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

export function hasBrowserSupabaseEnv() {
  return !!getEnv();
}

function createMockSupabaseClient() {
  const mockResult: MockQueryResult = {
    data: null,
    error: new Error("Supabase not configured"),
  };

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
      getSession: async () => ({ data: { session: null }, error: mockResult.error }),
      getUser: async () => ({ data: { user: null }, error: mockResult.error }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      signOut: async () => ({ error: mockResult.error }),
      signInWithPassword: async () => ({
        data: { session: null, user: null },
        error: mockResult.error,
      }),
      signUp: async () => ({
        data: { user: null, session: null },
        error: mockResult.error,
      }),
    },
    from: () => builder,
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: mockResult.error }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  };

  return mockClient as ReturnType<typeof createBrowserClient>;
}

export function getBrowserCookieOptions(): CookieOptionsWithName | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window.location.hostname;
  const isLocalhost =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

  if (isLocalhost) {
    return { sameSite: "lax", secure: false, path: "/" };
  }

  const domain = host.startsWith("www.") ? host.slice(4) : host;
  return { domain: `.${domain}`, sameSite: "lax", secure: true, path: "/" };
}

export function createBrowserSupabaseClient() {
  const env = getEnv();
  if (!env) {
    console.warn("Supabase env vars missing; using mock browser client");
    return createMockSupabaseClient();
  }
  return createBrowserClient(env.url, env.anonKey, {
    cookieOptions: getBrowserCookieOptions(),
  });
}
