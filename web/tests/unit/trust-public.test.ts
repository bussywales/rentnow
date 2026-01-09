import test from "node:test";
import assert from "node:assert/strict";

import { buildTrustBadges } from "../../lib/trust-markers";
import { fetchTrustPublicSnapshots } from "../../lib/trust-public";

void test("fetchTrustPublicSnapshots maps trust snapshot payload for badges", async () => {
  const client = {
    rpc: async (_fn: string, params?: Record<string, unknown>) => ({
      data:
        params?.target_profile_id === "host-1"
          ? [
              {
                profile_id: "host-1",
                email_verified: true,
                phone_verified: false,
                bank_verified: true,
                power_reliability: "good",
                water_reliability: null,
                internet_reliability: "fair",
              },
            ]
          : [],
      error: null,
    }),
  };

  const snapshots = await fetchTrustPublicSnapshots(client, ["host-1", "host-1"]);
  const badges = buildTrustBadges(snapshots["host-1"]);

  assert.equal(badges.length, 3);
  assert.equal(badges[0].label, "Email verified");
});
