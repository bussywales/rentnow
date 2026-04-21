import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  postAdminPropertyApproveResponse,
  type AdminPropertyApproveDeps,
} from "@/app/api/admin/properties/[id]/approve/route";

const makeRequest = () =>
  new NextRequest("http://localhost/api/admin/properties/prop1/approve", {
    method: "POST",
  });

void test("direct admin approve blocks when active listing limit is already reached", async () => {
  let updated = false;
  const supabase = {
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        const selectOptions = args[1] as { count?: string; head?: boolean } | undefined;
        if (table === "properties" && selectOptions?.count === "exact" && selectOptions?.head) {
          const result = { count: 5, error: null };
          const builder = {
            eq() {
              return builder;
            },
            neq() {
              return builder;
            },
            then(resolve: (value: typeof result) => unknown) {
              return Promise.resolve(resolve(result));
            },
          };
          return builder;
        }
        return {
          eq: () => ({
            maybeSingle: async () => {
              if (table === "profiles") {
                return { data: { role: "admin" } };
              }
              if (table === "profile_plans") {
                return {
                  data: {
                    plan_tier: "starter",
                    max_listings_override: 5,
                    valid_until: null,
                  },
                  error: null,
                };
              }
              return {
                data: {
                  id: "prop1",
                  owner_id: "owner-1",
                  is_active: false,
                  status: "pending",
                  city: "Lagos",
                  country_code: "NG",
                  listing_intent: "rent",
                  listing_type: "office",
                },
              };
            },
          }),
        };
      },
      update: () => ({
        eq: async () => {
          updated = true;
          return { error: null };
        },
      }),
      insert: async () => ({ error: null }),
    }),
  };

  const deps: AdminPropertyApproveDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () =>
      supabase as unknown as ReturnType<AdminPropertyApproveDeps["createServiceRoleClient"]>,
    getServerAuthUser: async () => ({
      supabase: supabase as unknown as Awaited<ReturnType<typeof import("@/lib/auth/server-session").getServerAuthUser>>["supabase"],
      user: { id: "admin-1" } as User,
    }),
    getListingExpiryDays: async () => 30,
    logProductAnalyticsEvent: async () => undefined,
    logApprovalAction: () => undefined,
  };

  const res = await postAdminPropertyApproveResponse(makeRequest(), "prop1", deps);
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, "plan_limit_reached");
  assert.equal(body.reason, "LISTING_LIMIT_REACHED");
  assert.equal(body.maxListings, 5);
  assert.equal(body.activeCount, 5);
  assert.equal(body.manageUrl, "/admin/properties");
  assert.match(String(body.resumeUrl ?? ""), /monetization=listing_limit/);
  assert.equal(updated, false);
});
