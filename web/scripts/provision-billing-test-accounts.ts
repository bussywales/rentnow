import { loadEnvConfig } from "@next/env";
import {
  BILLING_TEST_ACCOUNT_DEFAULT_PASSWORD_ENV,
  type BillingTestAccountProvisioningAdminClient,
  provisionBillingTestAccounts,
} from "@/lib/billing/billing-test-account-provisioning";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

loadEnvConfig(process.cwd());

async function main() {
  if (!hasServiceRoleEnv()) {
    throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const password = process.env[BILLING_TEST_ACCOUNT_DEFAULT_PASSWORD_ENV]?.trim() ?? "";
  if (!password) {
    throw new Error(
      `Missing ${BILLING_TEST_ACCOUNT_DEFAULT_PASSWORD_ENV}. Export it in your shell or set it in web/.env.local before running this command.`
    );
  }

  const adminClient = createServiceRoleClient() as unknown as BillingTestAccountProvisioningAdminClient;
  const summary = await provisionBillingTestAccounts({
    adminClient,
    password,
  });

  console.log("[billing-test-accounts] Provisioning complete.");
  console.log(
    `[billing-test-accounts] Processed ${summary.processed} accounts: created=${summary.created}, existing=${summary.alreadyExisted}, roles_updated=${summary.rolesUpdated}, profile_completeness_seeded=${summary.profileCompletenessSeeded}, baselines_prepared=${summary.baselinesPrepared}.`
  );
  for (const account of summary.accounts) {
    console.log(
      [
        "-",
        account.email,
        `role=${account.role}`,
        `created=${account.createdAuthUser}`,
        `roleUpdated=${account.profileRoleUpdated}`,
        `profileCompletenessSeeded=${account.profileCompletenessSeeded}`,
        `baselinePrepared=${account.billingBaselinePrepared}`,
      ].join(" ")
    );
  }
}

void main().catch((error) => {
  console.error(
    `[billing-test-accounts] ${error instanceof Error ? error.message : "Unknown provisioning failure."}`
  );
  process.exit(1);
});
