import test from "node:test";
import assert from "node:assert/strict";

import { requireUser } from "../../lib/authz";
import type { createServerSupabaseClient } from "../../lib/supabase/server";

void test("requireUser 401 responses do not clear auth cookies", async () => {
  const supabase = {
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: new Error("missing_user"),
      }),
    },
  };

  const result = await requireUser({
    request: new Request("http://localhost/api/test"),
    route: "/api/test",
    startTime: Date.now(),
    supabase: supabase as unknown as Awaited<
      ReturnType<typeof createServerSupabaseClient>
    >,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.headers.get("set-cookie"), null);
  }
});
