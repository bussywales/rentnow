import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/geocode/route";

void test("geocode returns 501 when MAPBOX_TOKEN missing", async () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn("Skipping geocode MAPBOX token test; Supabase env missing");
    return;
  }
  const original = process.env.MAPBOX_TOKEN;
  delete process.env.MAPBOX_TOKEN;
  const request = new Request("http://localhost/api/geocode?q=lagos");
  const res = await GET(request);
  assert.equal(res.status, 501);
  const json = (await res.json()) as { code?: string };
  assert.equal(json.code, "MAPBOX_NOT_CONFIGURED");
  process.env.MAPBOX_TOKEN = original;
});
