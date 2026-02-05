import test from "node:test";
import assert from "node:assert/strict";
import { ensureProfileRow } from "@/lib/profile/ensure-profile";

type MockProfile = {
  id: string;
  role?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  agent_storefront_enabled?: boolean | null;
  agent_slug?: string | null;
  agent_bio?: string | null;
};

function createMockClient(initialProfile: MockProfile | null = null) {
  let profile: MockProfile | null = initialProfile;
  const calls = {
    upserts: [] as Array<Record<string, unknown>>,
    selects: 0,
  };

  const query = {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => {
          calls.selects += 1;
          return { data: profile, error: null };
        },
      }),
    }),
    upsert: async (payload: Record<string, unknown>) => {
      calls.upserts.push(payload);
      profile = {
        id: payload.id as string,
        role: null,
        display_name: payload.display_name as string | null,
        full_name: payload.full_name as string | null,
        phone: payload.phone as string | null,
        avatar_url: payload.avatar_url as string | null,
        agent_storefront_enabled: payload.agent_storefront_enabled as boolean | null,
        agent_slug: null,
        agent_bio: null,
      };
      return { error: null };
    },
  };

  return {
    client: {
      from: () => query,
    },
    calls,
  };
}

void test("ensureProfileRow creates a missing profile row", async () => {
  const { client, calls } = createMockClient(null);

  const result = await ensureProfileRow({
    client: client as unknown as Parameters<typeof ensureProfileRow>[0]["client"],
    userId: "user-1",
    email: "user@example.com",
  });

  assert.equal(calls.selects, 2);
  assert.equal(calls.upserts.length, 1);
  assert.equal(calls.upserts[0].id, "user-1");
  assert.equal(calls.upserts[0].email, "user@example.com");
  assert.equal(result.created, true);
  assert.equal(result.profile?.id, "user-1");
});
