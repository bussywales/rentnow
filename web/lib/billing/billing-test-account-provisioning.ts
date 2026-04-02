import { isDesignatedBillingTestAccountEmail } from "@/lib/billing/billing-test-accounts";
import type { KnownRole } from "@/lib/roles";

export const BILLING_TEST_ACCOUNT_DEFAULT_PASSWORD_ENV = "BILLING_TEST_ACCOUNT_DEFAULT_PASSWORD";

export type BillingTestAccountRole = Exclude<KnownRole, "admin">;

export type BillingTestAccountSpec = {
  email: string;
  role: BillingTestAccountRole;
  market: "uk";
  cadence: "monthly" | "yearly";
};

export const BILLING_TEST_ACCOUNT_SPECS: BillingTestAccountSpec[] = [
  {
    email: "tenant-monthly-uk-01@rentnow.test",
    role: "tenant",
    market: "uk",
    cadence: "monthly",
  },
  {
    email: "tenant-yearly-uk-01@rentnow.test",
    role: "tenant",
    market: "uk",
    cadence: "yearly",
  },
  {
    email: "landlord-monthly-uk-01@rentnow.test",
    role: "landlord",
    market: "uk",
    cadence: "monthly",
  },
  {
    email: "landlord-yearly-uk-01@rentnow.test",
    role: "landlord",
    market: "uk",
    cadence: "yearly",
  },
  {
    email: "agent-monthly-uk-01@rentnow.test",
    role: "agent",
    market: "uk",
    cadence: "monthly",
  },
  {
    email: "agent-yearly-uk-01@rentnow.test",
    role: "agent",
    market: "uk",
    cadence: "yearly",
  },
] as const;

type AuthUserLike = {
  id: string;
  email?: string | null;
};

type ProfileRow = {
  id: string;
  role?: string | null;
  onboarding_completed?: boolean | null;
  onboarding_completed_at?: string | null;
  phone?: string | null;
  preferred_contact?: string | null;
};

type ProfilePlanRow = {
  profile_id: string;
  plan_tier?: string | null;
  billing_source?: string | null;
  valid_until?: string | null;
  max_listings_override?: number | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  stripe_current_period_end?: string | null;
  stripe_status?: string | null;
};

type AdminClientLike = {
  auth: {
    admin: {
      listUsers: (params: {
        page?: number;
        perPage?: number;
      }) => Promise<{
        data: { users?: AuthUserLike[] | null } | null;
        error?: { message?: string } | null;
      }>;
      createUser: (payload: {
        email: string;
        password: string;
        email_confirm?: boolean;
      }) => Promise<{
        data: { user?: AuthUserLike | null } | null;
        error?: { message?: string } | null;
      }>;
    };
  };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
    };
    upsert: (
      values: Record<string, unknown>,
      options?: { onConflict?: string }
    ) => Promise<{ error: { message?: string } | null }>;
  };
};

export type BillingTestAccountProvisioningAdminClient = AdminClientLike;

export type BillingTestAccountProvisionOutcome = {
  email: string;
  role: BillingTestAccountRole;
  createdAuthUser: boolean;
  profileRoleUpdated: boolean;
  profileCompletenessSeeded: boolean;
  billingBaselinePrepared: boolean;
  notesAppended: boolean;
};

export type BillingTestAccountProvisionSummary = {
  processed: number;
  created: number;
  alreadyExisted: number;
  rolesUpdated: number;
  profileCompletenessSeeded: number;
  baselinesPrepared: number;
  accounts: BillingTestAccountProvisionOutcome[];
};

const TEST_ACCOUNT_PLACEHOLDER_PHONE = "+440000000000";
const TEST_ACCOUNT_PLACEHOLDER_PREFERRED_CONTACT = "email";

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

async function findAuthUserByEmail(adminClient: AdminClientLike, email: string) {
  const target = normalizeEmail(email);
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message || "Unable to list auth users.");

    const users = data?.users ?? [];
    const match = users.find((user) => normalizeEmail(user.email) === target);
    if (match) return match;
    if (users.length < 200) return null;
    page += 1;
  }
}

async function waitForProfile(adminClient: AdminClientLike, profileId: string, retries = 8) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const { data, error } = await adminClient
      .from("profiles")
      .select("id, role, onboarding_completed, onboarding_completed_at, phone, preferred_contact")
      .eq("id", profileId)
      .maybeSingle();

    if (error) throw new Error(error.message || "Unable to load profile.");
    if (data) return data as ProfileRow;

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error("Timed out waiting for the auto-created profile row.");
}

async function loadPlan(adminClient: AdminClientLike, profileId: string) {
  const { data, error } = await adminClient
    .from("profile_plans")
    .select(
      "profile_id, plan_tier, billing_source, valid_until, max_listings_override, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_current_period_end, stripe_status"
    )
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load profile plan.");
  return (data as ProfilePlanRow | null) ?? null;
}

function shouldPrepareFreshBillingBaseline(plan: ProfilePlanRow | null) {
  if (!plan) return true;

  return (
    (plan.plan_tier ?? "free") === "free" &&
    (plan.billing_source ?? "manual") === "manual" &&
    !plan.valid_until &&
    plan.max_listings_override == null &&
    !plan.stripe_customer_id &&
    !plan.stripe_subscription_id &&
    !plan.stripe_price_id &&
    !plan.stripe_current_period_end &&
    !plan.stripe_status
  );
}

function shouldSeedProfileCompleteness(role: BillingTestAccountRole) {
  return role === "landlord" || role === "agent";
}

async function appendProvisioningNote(input: {
  adminClient: AdminClientLike;
  profileId: string;
  line: string;
}) {
  const { data: existing, error: existingError } = await input.adminClient
    .from("profile_billing_notes")
    .select("billing_notes")
    .eq("profile_id", input.profileId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Unable to load billing notes.");
  }

  const existingNotes = (existing as { billing_notes?: string | null } | null)?.billing_notes ?? "";
  const nextNotes = existingNotes ? `${existingNotes}\n${input.line}` : input.line;

  const { error } = await input.adminClient.from("profile_billing_notes").upsert(
    {
      profile_id: input.profileId,
      billing_notes: nextNotes,
      updated_at: new Date().toISOString(),
      updated_by: null,
    },
    { onConflict: "profile_id" }
  );

  if (error) {
    throw new Error(error.message || "Unable to append billing provisioning note.");
  }
}

export async function provisionBillingTestAccounts(input: {
  adminClient: AdminClientLike;
  password: string;
  now?: Date;
}) : Promise<BillingTestAccountProvisionSummary> {
  const password = input.password.trim();
  if (!password) {
    throw new Error(`${BILLING_TEST_ACCOUNT_DEFAULT_PASSWORD_ENV} is required.`);
  }

  const now = input.now ?? new Date();
  const stamp = now.toISOString();
  const summary: BillingTestAccountProvisionSummary = {
    processed: BILLING_TEST_ACCOUNT_SPECS.length,
    created: 0,
    alreadyExisted: 0,
    rolesUpdated: 0,
    profileCompletenessSeeded: 0,
    baselinesPrepared: 0,
    accounts: [],
  };

  for (const spec of BILLING_TEST_ACCOUNT_SPECS) {
    if (!isDesignatedBillingTestAccountEmail(spec.email)) {
      throw new Error(`Configured billing test account is not allowlisted by the billing test-account guard: ${spec.email}`);
    }

    let authUser = await findAuthUserByEmail(input.adminClient, spec.email);
    let createdAuthUser = false;
    if (!authUser) {
      const { data, error } = await input.adminClient.auth.admin.createUser({
        email: spec.email,
        password,
        email_confirm: true,
      });

      if (error || !data?.user?.id) {
        throw new Error(error?.message || `Unable to create auth user for ${spec.email}.`);
      }

      authUser = data.user;
      createdAuthUser = true;
      summary.created += 1;
    } else {
      summary.alreadyExisted += 1;
    }

    const profile = await waitForProfile(input.adminClient, authUser.id);
    const shouldUpdateRole =
      profile.role !== spec.role ||
      profile.onboarding_completed !== true ||
      !profile.onboarding_completed_at;

    if (shouldUpdateRole) {
      const { error } = await input.adminClient
        .from("profiles")
        .update({
          role: spec.role,
          onboarding_completed: true,
          onboarding_completed_at: stamp,
          updated_at: stamp,
        })
        .eq("id", authUser.id);

      if (error) {
        throw new Error(error.message || `Unable to update role for ${spec.email}.`);
      }

      summary.rolesUpdated += 1;
    }

    const shouldSeedCompleteness =
      shouldSeedProfileCompleteness(spec.role) && (!profile.phone || !profile.preferred_contact);

    if (shouldSeedCompleteness) {
      const { error } = await input.adminClient
        .from("profiles")
        .update({
          phone: profile.phone || TEST_ACCOUNT_PLACEHOLDER_PHONE,
          preferred_contact: profile.preferred_contact || TEST_ACCOUNT_PLACEHOLDER_PREFERRED_CONTACT,
          updated_at: stamp,
        })
        .eq("id", authUser.id);

      if (error) {
        throw new Error(error.message || `Unable to seed profile completeness for ${spec.email}.`);
      }

      summary.profileCompletenessSeeded += 1;
    }

    const existingPlan = await loadPlan(input.adminClient, authUser.id);
    const shouldPrepareBaseline = shouldPrepareFreshBillingBaseline(existingPlan);
    if (shouldPrepareBaseline) {
      const { error } = await input.adminClient.from("profile_plans").upsert(
        {
          profile_id: authUser.id,
          plan_tier: "free",
          billing_source: "manual",
          valid_until: stamp,
          max_listings_override: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          stripe_price_id: null,
          stripe_current_period_end: null,
          stripe_status: null,
          updated_at: stamp,
          updated_by: null,
          upgraded_at: stamp,
          upgraded_by: null,
        },
        { onConflict: "profile_id" }
      );

      if (error) {
        throw new Error(error.message || `Unable to prepare billing baseline for ${spec.email}.`);
      }

      summary.baselinesPrepared += 1;
    }

    await appendProvisioningNote({
      adminClient: input.adminClient,
      profileId: authUser.id,
      line: `[${stamp}] Internal billing smoke test account provisioned. role=${spec.role}. cadence=${spec.cadence}. market=${spec.market}. created_auth_user=${createdAuthUser}. profile_completeness_seeded=${shouldSeedCompleteness}. baseline_prepared=${shouldPrepareBaseline}. Existing subscriptions, webhook events, and prior billing history were preserved.`,
    });

    summary.accounts.push({
      email: spec.email,
      role: spec.role,
      createdAuthUser,
      profileRoleUpdated: shouldUpdateRole,
      profileCompletenessSeeded: shouldSeedCompleteness,
      billingBaselinePrepared: shouldPrepareBaseline,
      notesAppended: true,
    });
  }

  return summary;
}
