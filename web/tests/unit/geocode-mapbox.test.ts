import test from "node:test";
import assert from "node:assert/strict";
import { geocodeMapbox } from "@/lib/geocode/mapbox";

void test("geocodeMapbox builds query with country and proximity", async () => {
  const originalFetch = global.fetch;
  const calls: string[] = [];
  global.fetch = (async (url: string) => {
    calls.push(url);
    return {
      ok: true,
      json: async () => ({ features: [] }),
    } as unknown as Response;
  }) as typeof fetch;

  await geocodeMapbox("Burslem", "test-token", {
    countryCode: "gb",
    proximity: { longitude: -2.2, latitude: 53.0 },
  });

  global.fetch = originalFetch;
  assert.equal(calls.length, 1);
  const url = calls[0];
  const search = url.split("?")[1] ?? "";
  const params = new URLSearchParams(search);
  assert.equal(params.get("country"), "gb");
  assert.equal(params.get("proximity"), "-2.2,53");
});
