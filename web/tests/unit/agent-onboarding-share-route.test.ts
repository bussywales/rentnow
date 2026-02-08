import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { postAgentShareCompleteResponse } from "@/app/api/agent/onboarding/share-complete/route";

const makeRequest = () =>
  new NextRequest("http://localhost/api/agent/onboarding/share-complete", {
    method: "POST",
  });

void test("share complete route marks progress complete", async () => {
  const response = await postAgentShareCompleteResponse(makeRequest(), {
    hasServerSupabaseEnv: () => true,
    requireRole: (async () => ({
      ok: true,
      user: { id: "agent-1" } as User,
      supabase: {} as SupabaseClient,
      role: "agent",
    })) as typeof requireRole,
    markAgentSharedPageComplete: async () => ({
      hasListing: true,
      hasClientPage: true,
      hasSharedPage: true,
      completed: true,
      completedAt: new Date().toISOString(),
      publishedPageUrl: "https://example.com/agents/agent-one/c/client-one",
    }),
  });

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.progress.completed, true);
});
