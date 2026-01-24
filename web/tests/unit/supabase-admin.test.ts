import test from "node:test";
import assert from "node:assert/strict";
import { createServiceRoleClient, getLastServiceClientOptions, normalizeSupabaseUrl } from "@/lib/supabase/admin";

void test("normalizeSupabaseUrl prefixes https when missing", () => {
  const raw = "abc.supabase.co";
  const normalized = normalizeSupabaseUrl(raw);
  assert.equal(normalized, "https://abc.supabase.co");
});

void test("normalizeSupabaseUrl returns null on empty", () => {
  assert.equal(normalizeSupabaseUrl(""), null);
  assert.equal(normalizeSupabaseUrl(undefined), null);
});

void test("createServiceRoleClient pins schema to public", () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  // client will fail without real URL but options are captured for assertion
  try {
    createServiceRoleClient();
  } catch {
    /* ignore network error in test */
  }
  const opts = getLastServiceClientOptions();
  assert.ok(opts);
  assert.deepEqual(opts?.db, { schema: "public" });
  assert.deepEqual(opts?.auth, { persistSession: false, autoRefreshToken: false });
});
