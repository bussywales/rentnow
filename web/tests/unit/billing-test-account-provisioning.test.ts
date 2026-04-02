import test from "node:test";
import assert from "node:assert/strict";

import {
  BILLING_TEST_ACCOUNT_SPECS,
  provisionBillingTestAccounts,
} from "../../lib/billing/billing-test-account-provisioning";
import { isDesignatedBillingTestAccountEmail } from "../../lib/billing/billing-test-accounts";

type AuthUser = { id: string; email: string };
type Profile = {
  id: string;
  role: string | null;
  onboarding_completed: boolean | null;
  onboarding_completed_at: string | null;
};
type ProfilePlan = {
  profile_id: string;
  plan_tier: string | null;
  billing_source: string | null;
  valid_until: string | null;
  max_listings_override: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_current_period_end: string | null;
  stripe_status: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  upgraded_at?: string | null;
  upgraded_by?: string | null;
};
type BillingNotes = { profile_id: string; billing_notes: string | null };

function createProvisioningAdminClient(seed?: {
  authUsers?: AuthUser[];
  profiles?: Profile[];
  plans?: ProfilePlan[];
  notes?: BillingNotes[];
}) {
  const authUsers = [...(seed?.authUsers ?? [])];
  const profiles = new Map((seed?.profiles ?? []).map((profile) => [profile.id, profile]));
  const plans = new Map((seed?.plans ?? []).map((plan) => [plan.profile_id, plan]));
  const notes = new Map((seed?.notes ?? []).map((note) => [note.profile_id, note]));

  let idCounter = authUsers.length + 1;

  return {
    store: { authUsers, profiles, plans, notes },
    client: {
      auth: {
        admin: {
          listUsers: async ({ page = 1, perPage = 200 }) => {
            const start = (page - 1) * perPage;
            const users = authUsers.slice(start, start + perPage);
            return { data: { users }, error: null };
          },
          createUser: async ({ email }: { email: string }) => {
            const user = { id: `user-${idCounter++}`, email };
            authUsers.push(user);
            profiles.set(user.id, {
              id: user.id,
              role: null,
              onboarding_completed: false,
              onboarding_completed_at: null,
            });
            plans.set(user.id, {
              profile_id: user.id,
              plan_tier: "free",
              billing_source: "manual",
              valid_until: null,
              max_listings_override: null,
              stripe_customer_id: null,
              stripe_subscription_id: null,
              stripe_price_id: null,
              stripe_current_period_end: null,
              stripe_status: null,
            });
            return { data: { user }, error: null };
          },
        },
      },
      from(table: string) {
        if (table === "profiles") {
          return {
            select() {
              return {
                eq(_column: string, value: string) {
                  return {
                    maybeSingle: async () => ({ data: profiles.get(value) ?? null, error: null }),
                  };
                },
              };
            },
            update(values: Record<string, unknown>) {
              return {
                eq(_column: string, value: string) {
                  const existing = profiles.get(value);
                  if (!existing) return Promise.resolve({ error: { message: "missing profile" } });
                  profiles.set(value, { ...existing, ...values } as Profile);
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        }

        if (table === "profile_plans") {
          return {
            select() {
              return {
                eq(_column: string, value: string) {
                  return {
                    maybeSingle: async () => ({ data: plans.get(value) ?? null, error: null }),
                  };
                },
              };
            },
            upsert(values: Record<string, unknown>) {
              const profileId = String(values.profile_id);
              plans.set(profileId, { ...(plans.get(profileId) ?? {}), ...values } as ProfilePlan);
              return Promise.resolve({ error: null });
            },
          };
        }

        if (table === "profile_billing_notes") {
          return {
            select() {
              return {
                eq(_column: string, value: string) {
                  return {
                    maybeSingle: async () => ({
                      data: notes.get(value) ?? null,
                      error: null,
                    }),
                  };
                },
              };
            },
            upsert(values: Record<string, unknown>) {
              const profileId = String(values.profile_id);
              notes.set(profileId, {
                profile_id: profileId,
                billing_notes:
                  typeof values.billing_notes === "string" ? values.billing_notes : null,
              });
              return Promise.resolve({ error: null });
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    },
  };
}

void test("billing test account provisioner defines the six UK smoke accounts on designated .test domains", () => {
  assert.equal(BILLING_TEST_ACCOUNT_SPECS.length, 6);
  assert.deepEqual(
    BILLING_TEST_ACCOUNT_SPECS.map((account) => account.email),
    [
      "tenant-monthly-uk-01@rentnow.test",
      "tenant-yearly-uk-01@rentnow.test",
      "landlord-monthly-uk-01@rentnow.test",
      "landlord-yearly-uk-01@rentnow.test",
      "agent-monthly-uk-01@rentnow.test",
      "agent-yearly-uk-01@rentnow.test",
    ]
  );

  for (const account of BILLING_TEST_ACCOUNT_SPECS) {
    assert.equal(isDesignatedBillingTestAccountEmail(account.email), true);
    assert.match(account.email, /@rentnow\.test$/);
  }
});

void test("billing test account provisioner creates missing users and prepares a reusable baseline", async () => {
  const { client, store } = createProvisioningAdminClient();
  const now = new Date("2026-04-02T10:00:00.000Z");

  const result = await provisionBillingTestAccounts({
    adminClient: client as never,
    password: "shared-secret",
    now,
  });

  assert.equal(result.created, 6);
  assert.equal(result.alreadyExisted, 0);
  assert.equal(result.rolesUpdated, 6);
  assert.equal(result.baselinesPrepared, 6);

  for (const spec of BILLING_TEST_ACCOUNT_SPECS) {
    const user = store.authUsers.find((candidate) => candidate.email === spec.email);
    assert.ok(user, `missing auth user for ${spec.email}`);

    const profile = store.profiles.get(user.id);
    assert.equal(profile?.role, spec.role);
    assert.equal(profile?.onboarding_completed, true);

    const plan = store.plans.get(user.id);
    assert.equal(plan?.plan_tier, "free");
    assert.equal(plan?.billing_source, "manual");
    assert.equal(plan?.valid_until, now.toISOString());
    assert.equal(plan?.stripe_customer_id, null);

    const note = store.notes.get(user.id);
    assert.match(note?.billing_notes ?? "", /Internal billing smoke test account provisioned/);
  }
});

void test("billing test account provisioner leaves existing non-baseline billing state intact", async () => {
  const existingUser = { id: "existing-1", email: "agent-monthly-uk-01@rentnow.test" };
  const { client, store } = createProvisioningAdminClient({
    authUsers: [existingUser],
    profiles: [
      {
        id: existingUser.id,
        role: "tenant",
        onboarding_completed: false,
        onboarding_completed_at: null,
      },
    ],
    plans: [
      {
        profile_id: existingUser.id,
        plan_tier: "pro",
        billing_source: "stripe",
        valid_until: "2026-05-01T00:00:00.000Z",
        max_listings_override: null,
        stripe_customer_id: "cus_live_123",
        stripe_subscription_id: "sub_live_123",
        stripe_price_id: "price_live_123",
        stripe_current_period_end: "2026-05-01T00:00:00.000Z",
        stripe_status: "active",
      },
    ],
  });

  const result = await provisionBillingTestAccounts({
    adminClient: client as never,
    password: "shared-secret",
    now: new Date("2026-04-02T10:00:00.000Z"),
  });

  const existingOutcome = result.accounts.find((account) => account.email === existingUser.email);
  assert.equal(existingOutcome?.createdAuthUser, false);
  assert.equal(existingOutcome?.profileRoleUpdated, true);
  assert.equal(existingOutcome?.billingBaselinePrepared, false);

  const preservedPlan = store.plans.get(existingUser.id);
  assert.equal(preservedPlan?.billing_source, "stripe");
  assert.equal(preservedPlan?.stripe_subscription_id, "sub_live_123");
  assert.equal(preservedPlan?.plan_tier, "pro");
});
