import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SupportPlaybooksLandingPage from "@/app/help/admin/support-playbooks/page";
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

void test("support playbooks landing renders multiple links", () => {
  const html = renderToStaticMarkup(React.createElement(SupportPlaybooksLandingPage));
  const matches = html.match(/support-playbooks\//g) ?? [];
  assert.ok(matches.length >= 6, "expected at least 6 playbook links");
});

void test("tenant role is denied admin support playbooks", async () => {
  const supabase = createMockSupabase("tenant");
  const allowed = await canAccessAdminHelp(
    supabase as unknown as Parameters<typeof canAccessAdminHelp>[0],
    "user-123"
  );
  assert.equal(allowed, false);
});
