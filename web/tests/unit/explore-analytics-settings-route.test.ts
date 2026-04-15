import test from "node:test";
import assert from "node:assert/strict";
import { getExploreAnalyticsSettingsResponse } from "@/app/api/analytics/explore/settings/route";

void test("explore analytics settings route is readable without workspace auth", async () => {
  const request = new Request("http://localhost/api/analytics/explore/settings", {
    method: "GET",
  });

  const response = await getExploreAnalyticsSettingsResponse(request, {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getExploreAnalyticsSettings: async () => ({
      enabled: true,
      consentRequired: false,
      noticeEnabled: true,
    }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok?: boolean;
    settings?: { enabled?: boolean; consentRequired?: boolean; noticeEnabled?: boolean };
  };
  assert.equal(body.ok, true);
  assert.deepEqual(body.settings, {
    enabled: true,
    consentRequired: false,
    noticeEnabled: true,
  });
});
