import test from "node:test";
import assert from "node:assert/strict";
import { resolveAgentOnboardingProgress } from "@/lib/agents/agent-onboarding.server";

void test("resolveAgentOnboardingProgress returns correct flags", async () => {
  const supabaseStub = {
    from: (table: string) => {
      if (table === "properties") {
        return {
          select: () => ({
            eq: async () => ({ data: [{ id: "listing-1" }] }),
          }),
        };
      }
      if (table === "agent_client_pages") {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                {
                  id: "page-1",
                  client_slug: "client-one",
                  published: true,
                  updated_at: new Date().toISOString(),
                },
              ],
            }),
          }),
        };
      }
      if (table === "agent_onboarding_progress") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  user_id: "agent-1",
                  has_listing: false,
                  has_client_page: false,
                  has_shared_page: true,
                  completed_at: null,
                },
              }),
            }),
          }),
          upsert: async () => ({ error: null }),
        };
      }
      return {};
    },
  };

  const result = await resolveAgentOnboardingProgress({
    supabase: supabaseStub,
    userId: "agent-1",
    agentSlug: "agent-one",
    siteUrl: "https://example.com",
  });

  assert.equal(result.hasListing, true);
  assert.equal(result.hasClientPage, true);
  assert.equal(result.hasSharedPage, true);
  assert.equal(result.completed, true);
  assert.ok(result.publishedPageUrl?.includes("/agents/agent-one/c/client-one"));
});
