import test from "node:test";
import assert from "node:assert/strict";

import { canAccessAdminHelp } from "@/lib/help/admin-access";

type MockSupabase = {
  from: () => {
    select: () => {
      eq: () => {
        maybeSingle: () => Promise<{ data: { role: string | null } | null }>;
      };
    };
  };
};

function createMockSupabase(role: string | null): MockSupabase {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { role } }),
        }),
      }),
    }),
  };
}

void test("admin can access admin help", async () => {
  const supabase = createMockSupabase("admin");
  const result = await canAccessAdminHelp(
    supabase as unknown as Parameters<typeof canAccessAdminHelp>[0],
    "user-123"
  );
  assert.equal(result, true);
});

void test("non-admin cannot access admin help", async () => {
  const supabase = createMockSupabase("tenant");
  const result = await canAccessAdminHelp(
    supabase as unknown as Parameters<typeof canAccessAdminHelp>[0],
    "user-123"
  );
  assert.equal(result, false);
});

void test("admin help routes import", async () => {
  await assert.doesNotReject(async () => import("@/app/help/admin/page"));
  await assert.doesNotReject(async () => import("@/app/help/admin/listings/review-workflow/page"));
});
