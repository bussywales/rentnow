import test from "node:test";
import assert from "node:assert/strict";
import { getExploreAnalyticsSettingsResponse } from "@/app/api/analytics/explore/settings/route";

void test("explore analytics settings route allows tenant, agent, and landlord roles", async () => {
  let capturedRoles: string[] | null = null;
  const request = new Request("http://localhost/api/analytics/explore/settings", {
    method: "GET",
  });

  const response = await getExploreAnalyticsSettingsResponse(request, {
    hasServerSupabaseEnv: () => true,
    requireRole: async ({ roles }) => {
      capturedRoles = [...roles];
      return {
        ok: false,
        response: new Response(null, { status: 401 }),
      } as never;
    },
    getExploreAnalyticsSettings: async () => ({
      enabled: true,
      consentRequired: false,
      noticeEnabled: true,
    }),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(capturedRoles, ["tenant", "agent", "landlord"]);
});
