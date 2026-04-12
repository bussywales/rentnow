import test from "node:test";
import assert from "node:assert/strict";
import {
  getServerSupabaseEnv,
  getServerSupabaseUrl,
  resetServerSupabaseEnvWarningsForTest,
} from "@/lib/env";

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

void test("server supabase env prefers private vars without warning", () => {
  resetServerSupabaseEnvWarningsForTest();
  const snapshot = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (value?: unknown) => warnings.push(String(value ?? ""));

  process.env.SUPABASE_URL = "https://private.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.supabase.co";
  process.env.SUPABASE_ANON_KEY = "private-anon";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon";

  try {
    assert.deepEqual(getServerSupabaseEnv(), {
      url: "https://private.supabase.co",
      anonKey: "private-anon",
    });
    assert.equal(getServerSupabaseUrl(), "https://private.supabase.co");
    assert.equal(warnings.length, 0);
  } finally {
    console.warn = originalWarn;
    restoreEnv(snapshot);
  }
});

void test("server supabase env falls back to public vars with an explicit warning", () => {
  resetServerSupabaseEnvWarningsForTest();
  const snapshot = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (value?: unknown) => warnings.push(String(value ?? ""));

  delete process.env.SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.supabase.co";
  delete process.env.SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon";

  try {
    assert.deepEqual(getServerSupabaseEnv(), {
      url: "https://public.supabase.co",
      anonKey: "public-anon",
    });
    assert.equal(getServerSupabaseUrl(), "https://public.supabase.co");
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /SUPABASE_URL is missing/);
    assert.match(warnings[1], /SUPABASE_ANON_KEY is missing/);
  } finally {
    console.warn = originalWarn;
    restoreEnv(snapshot);
  }
});
