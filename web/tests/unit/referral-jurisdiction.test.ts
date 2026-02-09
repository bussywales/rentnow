import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserJurisdiction } from "@/lib/referrals/jurisdiction";

type ProfileRow = {
  country: string | null;
  country_code?: string | null;
};

function makeClient(profile: ProfileRow | null, metadataCountry: string | null) {
  return {
    from: (table: string) => {
      assert.equal(table, "profiles");
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: profile, error: null }),
          }),
        }),
      };
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: {
              user_metadata: {
                country: metadataCountry,
              },
            },
          },
        }),
      },
    },
  } as unknown as SupabaseClient;
}

void test("getUserJurisdiction prioritizes profiles.country", async () => {
  const client = makeClient({ country: "Nigeria", country_code: "NG" }, "GB");
  const result = await getUserJurisdiction(client, "user-1", {
    authMetadataCountry: "US",
  });

  assert.equal(result.countryCode, "NG");
  assert.equal(result.source, "profile.country");
});

void test("getUserJurisdiction falls back to auth metadata country", async () => {
  const client = makeClient({ country: null, country_code: null }, "GH");
  const result = await getUserJurisdiction(client, "user-2");

  assert.equal(result.countryCode, "GH");
  assert.equal(result.source, "auth.metadata.country");
});

void test("getUserJurisdiction defaults to NG when no country exists", async () => {
  const client = makeClient({ country: null, country_code: null }, null);
  const result = await getUserJurisdiction(client, "user-3", {
    defaultCountryCode: "NG",
  });

  assert.equal(result.countryCode, "NG");
  assert.equal(result.source, "default");
});
