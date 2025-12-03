import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

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
  const cookieStore = (() => {
    try {
      return cookies();
    } catch {
      return null;
    }
  })();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        try {
          const store = cookieStore as unknown as { get?: (n: string) => { value?: string } };
          return store?.get?.(name)?.value;
        } catch {
          return undefined;
        }
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          const store = cookieStore as unknown as {
            set?: (opts: CookieOptions & { name: string; value: string }) => void;
          };
          store?.set?.({ name, value, ...options });
        } catch {
          /* no-op on read-only cookie store */
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          const store = cookieStore as unknown as {
            set?: (opts: CookieOptions & { name: string; value: string }) => void;
          };
          store?.set?.({ name, value: "", ...options, maxAge: 0 });
        } catch {
          /* no-op */
        }
      },
    },
  });
}
