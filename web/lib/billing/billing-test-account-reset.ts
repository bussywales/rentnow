import { isDesignatedBillingTestAccountEmail, findBillingResetBlocker } from "@/lib/billing/billing-test-accounts";

type ExistingPlan = {
  billing_source?: string | null;
  plan_tier?: string | null;
  valid_until?: string | null;
  max_listings_override?: number | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  stripe_status?: string | null;
  stripe_current_period_end?: string | null;
};

type SubscriptionLookupRow = {
  provider?: string | null;
  provider_subscription_id?: string | null;
  status?: string | null;
  current_period_end?: string | null;
};

type AdminClientLike = {
  auth: {
    admin: {
      getUserById: (
        userId: string
      ) => Promise<{ data: { user?: { email?: string | null } | null } | null; error?: { message?: string } | null }>;
    };
  };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
        in?: (column: string, values: string[]) => {
          order: (
            column: string,
            options?: { ascending?: boolean; nullsFirst?: boolean }
          ) => {
            limit: (count: number) => Promise<{ data: unknown[] | null; error: { message?: string } | null }>;
          };
        };
      };
    };
    upsert: (
      values: Record<string, unknown>,
      options?: { onConflict?: string }
    ) => Promise<{ error: { message?: string } | null }>;
  };
};

export type BillingTestAccountResetResult =
  | {
      ok: true;
      email: string | null;
      reusableNow: true;
      providerStatePresent: boolean;
      validUntil: string;
    }
  | {
      ok: false;
      code:
        | "auth_user_not_found"
        | "not_designated_test_account"
        | "active_provider_subscription"
        | "profile_plan_update_failed";
      error: string;
      email: string | null;
      providerStatePresent: boolean;
      blockerSubscriptionId?: string | null;
      blockerProvider?: string | null;
      blockerStatus?: string | null;
    };

async function loadExistingPlan(adminClient: AdminClientLike, profileId: string) {
  const { data, error } = await adminClient
    .from("profile_plans")
    .select(
      "billing_source, plan_tier, valid_until, max_listings_override, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_status, stripe_current_period_end"
    )
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load billing state.");
  }

  return (data as ExistingPlan | null) ?? null;
}

async function loadSubscriptionRows(adminClient: AdminClientLike, profileId: string) {
  const subscriptionsQuery = adminClient
    .from("subscriptions")
    .select("provider, provider_subscription_id, status, current_period_end")
    .eq("user_id", profileId) as unknown as {
    in: (column: string, values: string[]) => {
      order: (
        column: string,
        options?: { ascending?: boolean; nullsFirst?: boolean }
      ) => {
        limit: (count: number) => Promise<{ data: unknown[] | null; error: { message?: string } | null }>;
      };
    };
  };

  const { data, error } = await subscriptionsQuery
    .in("status", ["active", "trialing", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired"])
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(10);

  if (error) {
    throw new Error(error.message || "Unable to load provider subscriptions.");
  }

  return (data as SubscriptionLookupRow[] | null) ?? [];
}

async function appendBillingResetNote(input: {
  adminClient: AdminClientLike;
  profileId: string;
  actorId: string;
  line: string;
}) {
  const { data: existing } = await input.adminClient
    .from("profile_billing_notes")
    .select("billing_notes")
    .eq("profile_id", input.profileId)
    .maybeSingle();

  const existingNotes = (existing as { billing_notes?: string | null } | null)?.billing_notes ?? "";
  const nextNotes = existingNotes ? `${existingNotes}\n${input.line}` : input.line;

  await input.adminClient.from("profile_billing_notes").upsert(
    {
      profile_id: input.profileId,
      billing_notes: nextNotes,
      updated_at: new Date().toISOString(),
      updated_by: input.actorId,
    },
    { onConflict: "profile_id" }
  );
}

export async function resetBillingTestAccount(input: {
  adminClient: AdminClientLike;
  profileId: string;
  actorId: string;
  reason: string;
}): Promise<BillingTestAccountResetResult> {
  const [{ data: authUser }, existingPlan, subscriptionRows] = await Promise.all([
    input.adminClient.auth.admin.getUserById(input.profileId),
    loadExistingPlan(input.adminClient, input.profileId),
    loadSubscriptionRows(input.adminClient, input.profileId),
  ]);

  const email = authUser?.user?.email?.trim().toLowerCase() ?? null;
  if (!email) {
    return {
      ok: false,
      code: "auth_user_not_found",
      error: "Unable to resolve the auth user email for this account.",
      email: null,
      providerStatePresent: Boolean(subscriptionRows.length),
    };
  }

  const providerStatePresent = Boolean(
    subscriptionRows.length ||
      existingPlan?.stripe_customer_id ||
      existingPlan?.stripe_subscription_id ||
      existingPlan?.stripe_price_id ||
      existingPlan?.stripe_status
  );
  const stamp = new Date().toISOString();

  if (!isDesignatedBillingTestAccountEmail(email)) {
    await appendBillingResetNote({
      adminClient: input.adminClient,
      profileId: input.profileId,
      actorId: input.actorId,
      line: `[${stamp}] Billing test-account reset denied. Reason: ${input.reason}. email=${email}. designated_test_account=false. provider_state_present=${providerStatePresent}.`,
    });

    return {
      ok: false,
      code: "not_designated_test_account",
      error:
        "Reset is allowed only for designated internal billing test accounts. Use BILLING_TEST_ACCOUNT_EMAILS or an internal .test domain.",
      email,
      providerStatePresent,
    };
  }

  const blocker = findBillingResetBlocker(subscriptionRows);
  if (blocker) {
    await appendBillingResetNote({
      adminClient: input.adminClient,
      profileId: input.profileId,
      actorId: input.actorId,
      line: `[${stamp}] Billing test-account reset blocked. Reason: ${input.reason}. email=${email}. designated_test_account=true. provider_state_present=${providerStatePresent}. active_subscription_provider=${blocker.provider ?? "unknown"}. active_subscription_id=${blocker.providerSubscriptionId ?? "—"}. active_subscription_status=${blocker.status ?? "—"}.`,
    });

    return {
      ok: false,
      code: "active_provider_subscription",
      error:
        "Reset is blocked because an active provider subscription still exists. Cancel the subscription first; historical records are preserved.",
      email,
      providerStatePresent,
      blockerProvider: blocker.provider,
      blockerSubscriptionId: blocker.providerSubscriptionId,
      blockerStatus: blocker.status,
    };
  }

  const validUntil = stamp;
  const { error } = await input.adminClient.from("profile_plans").upsert(
    {
      profile_id: input.profileId,
      plan_tier: "free",
      billing_source: "manual",
      valid_until: validUntil,
      max_listings_override: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      stripe_current_period_end: null,
      stripe_status: null,
      updated_at: stamp,
      updated_by: input.actorId,
      upgraded_at: stamp,
      upgraded_by: input.actorId,
    },
    { onConflict: "profile_id" }
  );

  if (error) {
    return {
      ok: false,
      code: "profile_plan_update_failed",
      error: error.message || "Unable to reset the billing test account.",
      email,
      providerStatePresent,
    };
  }

  await appendBillingResetNote({
    adminClient: input.adminClient,
    profileId: input.profileId,
    actorId: input.actorId,
    line: `[${stamp}] Billing test-account reset applied. Reason: ${input.reason}. email=${email}. designated_test_account=true. provider_state_present=${providerStatePresent}. Cleared profile_plans to free expired-manual baseline. Historical subscriptions and webhook events were preserved.`,
  });

  return {
    ok: true,
    email,
    reusableNow: true,
    providerStatePresent,
    validUntil,
  };
}
