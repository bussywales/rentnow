import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/admin/config-status/route";

test("config status rejects when supabase env missing", async () => {
  const original = process.env.SUPABASE_URL;
  // simulate missing env
  // @ts-expect-error simulate unset env
  process.env.SUPABASE_URL = "";
  const res = await GET();
  assert.equal(res.status, 503);
  // restore
  if (original) process.env.SUPABASE_URL = original;
});
