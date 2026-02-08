import test from "node:test";
import assert from "node:assert/strict";
import { requireLegalAcceptance } from "@/lib/legal/guard.server";
import type { SupabaseClient } from "@supabase/supabase-js";

test("requireLegalAcceptance blocks when missing audiences", async () => {
  const result = await requireLegalAcceptance(
    {
      request: new Request("http://localhost/test"),
      supabase: {} as SupabaseClient,
      userId: "user-1",
      role: "tenant",
    },
    {
      resolveJurisdiction: async () => "NG",
      getLegalAcceptanceStatus: async () => ({
        jurisdiction: "NG",
        role: "tenant",
        roles: ["tenant"],
        requiredAudiences: ["MASTER", "AUP", "DISCLAIMER", "TENANT"],
        documents: [],
        acceptedAudiences: [],
        pendingAudiences: ["MASTER"],
        missingAudiences: ["AUP", "DISCLAIMER", "TENANT"],
        isComplete: false,
      }),
    }
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.status, 428);
  }
});

test("requireLegalAcceptance passes when complete", async () => {
  const result = await requireLegalAcceptance(
    {
      request: new Request("http://localhost/test"),
      supabase: {} as SupabaseClient,
      userId: "user-2",
      role: "admin",
    },
    {
      resolveJurisdiction: async () => "NG",
      getLegalAcceptanceStatus: async () => ({
        jurisdiction: "NG",
        role: "admin",
        roles: ["admin"],
        requiredAudiences: ["MASTER", "AUP", "DISCLAIMER", "ADMIN_OPS"],
        documents: [],
        acceptedAudiences: ["MASTER", "AUP", "DISCLAIMER", "ADMIN_OPS"],
        pendingAudiences: [],
        missingAudiences: [],
        isComplete: true,
      }),
    }
  );

  assert.equal(result.ok, true);
});
