import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSupabaseUrl } from "@/lib/supabase/admin";

void test("normalizeSupabaseUrl prefixes https when missing", () => {
  const raw = "abc.supabase.co";
  const normalized = normalizeSupabaseUrl(raw);
  assert.equal(normalized, "https://abc.supabase.co");
});

void test("normalizeSupabaseUrl returns null on empty", () => {
  assert.equal(normalizeSupabaseUrl(""), null);
  assert.equal(normalizeSupabaseUrl(undefined), null);
});
