import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingRole } from "@/lib/billing/stripe-plans";
import {
  resolveCanadaRentalPaygReadiness,
  type CanadaRentalPaygReadinessInput,
  type CanadaRentalPaygReadinessResult,
} from "@/lib/billing/canada-payg-readiness.server";
import type {
  MarketBillingPolicyRow,
  MarketListingEntitlementRow,
  MarketOneOffPriceRow,
} from "@/lib/billing/market-pricing";
import { getPlanUsage } from "@/lib/plan-enforcement";
import { parseAppSettingBool } from "@/lib/settings/app-settings";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingsMap } from "@/lib/settings/app-settings.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import type { UserRole } from "@/lib/types";

export const CANADA_RENTAL_PAYG_RUNTIME_PREREQUISITES = [
  "Feature gate canada_rental_payg_runtime_enabled must be ON.",
  "Canada market policy must be approved or live.",
  "Listing must be a Canada rental submission, not shortlet, sale, or off-plan.",
  "Provider must remain Stripe and currency must remain CAD.",
  "A matching active and enabled CA listing_submission price row must exist.",
  "A matching active CA entitlement row must exist with beyond-cap PAYG enabled.",
  "Role must be landlord or agent, and Enterprise must remain blocked until runtime tier support exists.",
  "Live checkout must be shipped separately before any production activation.",
] as const;

export type CanadaRentalPaygRuntimeDecision = {
  gateEnabled: boolean;
  listingUnlockGateEnabled: boolean;
  checkoutSessionCreationGateEnabled: boolean;
  webhookFulfilmentGateEnabled: boolean;
  paymentPersistenceGateEnabled: boolean;
  entitlementGrantGateEnabled: boolean;
  marketCountry: string | null;
  runtimeSource: "legacy";
  resolverAvailable: true;
  stripePrepLayerAvailable: true;
  stripeSessionRequestDefined: true;
  webhookContractDefined: true;
  paymentPersistenceContractDefined: true;
  entitlementGrantContractDefined: true;
  paymentPersistencePayloadDefined: true;
  entitlementGrantPayloadDefined: true;
  entitlementReadIntegrationAvailable: true;
  listingCapBypassDecisionDefined: true;
  entitlementConsumeContractDefined: true;
  fulfilmentPlanDefined: true;
  checkoutEnabled: false;
  checkoutCreationEnabled: boolean;
  paymentRecoveryScaffolded: true;
  liveWebhookFulfilmentEnabled: boolean;
  fulfilmentExecutionEnabled: boolean;
  fulfilmentMutationEnabled: boolean;
  entitlementConsumeExecutionEnabled: false;
  entitlementConsumeMutationEnabled: false;
  listingSubmitAfterConsumeEnabled: false;
  listingUnlockEnabled: false;
  liveCapBypassEnabled: false;
  paymentRecordWriteEnabled: boolean;
  readiness: CanadaRentalPaygReadinessResult;
  nextActivationPrerequisites: string[];
};

export type CanadaRentalPaygRuntimeInput = {
  serviceClient: SupabaseClient | UntypedAdminClient;
  ownerId: string;
  listingId?: string | null;
  marketCountry?: string | null;
  listingIntent?: string | null;
  rentalType?: string | null;
  role?: UserRole | BillingRole | null;
  tier?: string | null;
  activeListingCount?: number | null;
};

export type CanadaRentalPaygRuntimeDiagnostics = {
  gateEnabled: boolean;
  listingUnlockGateEnabled: boolean;
  checkoutSessionCreationGateEnabled: boolean;
  webhookFulfilmentGateEnabled: boolean;
  paymentPersistenceGateEnabled: boolean;
  entitlementGrantGateEnabled: boolean;
  resolverAvailable: true;
  stripePrepLayerAvailable: true;
  stripeSessionRequestDefined: true;
  webhookContractDefined: true;
  paymentPersistenceContractDefined: true;
  entitlementGrantContractDefined: true;
  paymentPersistencePayloadDefined: true;
  entitlementGrantPayloadDefined: true;
  entitlementReadIntegrationAvailable: true;
  listingCapBypassDecisionDefined: true;
  entitlementConsumeContractDefined: true;
  fulfilmentPlanDefined: true;
  checkoutEnabled: false;
  checkoutCreationEnabled: boolean;
  paymentRecoveryScaffolded: true;
  liveWebhookFulfilmentEnabled: boolean;
  fulfilmentExecutionEnabled: boolean;
  fulfilmentMutationEnabled: boolean;
  entitlementConsumeExecutionEnabled: false;
  entitlementConsumeMutationEnabled: false;
  listingSubmitAfterConsumeEnabled: false;
  listingUnlockEnabled: false;
  liveCapBypassEnabled: false;
  paymentRecordWriteEnabled: boolean;
  runtimeSource: "legacy";
  nextActivationPrerequisites: string[];
};

type CanadaRuntimeRoleContext = {
  role: UserRole | BillingRole | null;
  tier: string | null;
  activeListingCount: number | null;
};

type CanadaPricingRows = {
  policies: MarketBillingPolicyRow[];
  entitlements: MarketListingEntitlementRow[];
  oneOffPrices: MarketOneOffPriceRow[];
};

type CanadaRuntimeClient = SupabaseClient | UntypedAdminClient;

type CanadaRentalPaygRuntimeDeps = {
  getGateEnabled: typeof getCanadaRentalPaygRuntimeEnabled;
  getListingUnlockGateEnabled: typeof getCanadaRentalPaygListingUnlockEnabled;
  getCheckoutSessionCreationGateEnabled: typeof getCanadaRentalPaygCheckoutSessionCreationEnabled;
  getWebhookFulfilmentGateEnabled: typeof getCanadaRentalPaygWebhookFulfilmentEnabled;
  getPaymentPersistenceGateEnabled: typeof getCanadaRentalPaygPaymentPersistenceEnabled;
  getEntitlementGrantGateEnabled: typeof getCanadaRentalPaygEntitlementGrantEnabled;
  loadPricingRows: (client: CanadaRuntimeClient) => Promise<CanadaPricingRows>;
  loadRoleContext: (input: {
    serviceClient: CanadaRuntimeClient;
    ownerId: string;
    listingId?: string | null;
  }) => Promise<CanadaRuntimeRoleContext>;
  resolveReadiness: (input: CanadaRentalPaygReadinessInput) => CanadaRentalPaygReadinessResult;
};

async function loadCanadaPricingRows(client: CanadaRuntimeClient): Promise<CanadaPricingRows> {
  const queryClient = client as UntypedAdminClient;
  const [policiesResult, entitlementsResult, oneOffPricesResult] = await Promise.all([
    queryClient
      .from("market_billing_policies")
      .select(
        "id,market_country,currency,policy_state,rental_enabled,sale_enabled,shortlet_enabled,payg_listing_enabled,featured_listing_enabled,subscription_checkout_enabled,listing_payg_provider,featured_listing_provider,operator_notes,effective_from,active,created_by,updated_by,created_at,updated_at"
      )
      .eq("market_country", "CA"),
    queryClient
      .from("market_listing_entitlements")
      .select(
        "id,market_country,role,tier,active_listing_limit,listing_credits,featured_credits,client_page_limit,payg_beyond_cap_enabled,operator_notes,effective_from,active,created_by,updated_by,created_at,updated_at"
      )
      .eq("market_country", "CA"),
    queryClient
      .from("market_one_off_price_book")
      .select(
        "id,market_country,product_code,currency,amount_minor,provider,role,tier,enabled,effective_from,active,operator_notes,created_by,updated_by,created_at,updated_at"
      )
      .eq("market_country", "CA")
      .eq("product_code", "listing_submission"),
  ]);

  return {
    policies: (policiesResult.data ?? []) as MarketBillingPolicyRow[],
    entitlements: (entitlementsResult.data ?? []) as MarketListingEntitlementRow[],
    oneOffPrices: (oneOffPricesResult.data ?? []) as MarketOneOffPriceRow[],
  };
}

async function loadCanadaRuntimeRoleContext(input: {
  serviceClient: CanadaRuntimeClient;
  ownerId: string;
  listingId?: string | null;
}): Promise<CanadaRuntimeRoleContext> {
  const [ownerProfileResult, usage] = await Promise.all([
    (input.serviceClient as UntypedAdminClient)
      .from("profiles")
      .select("role")
      .eq("id", input.ownerId)
      .maybeSingle(),
    getPlanUsage({
      supabase: input.serviceClient as SupabaseClient,
      serviceClient: input.serviceClient as SupabaseClient,
      ownerId: input.ownerId,
      excludeId: input.listingId ?? null,
    }),
  ]);

  return {
    role: (ownerProfileResult.data as { role?: UserRole | null } | null)?.role ?? null,
    tier: usage.plan.tier ?? null,
    activeListingCount: usage.error ? null : usage.activeCount,
  };
}

const defaultDeps: CanadaRentalPaygRuntimeDeps = {
  getGateEnabled: getCanadaRentalPaygRuntimeEnabled,
  getListingUnlockGateEnabled: getCanadaRentalPaygListingUnlockEnabled,
  getCheckoutSessionCreationGateEnabled: getCanadaRentalPaygCheckoutSessionCreationEnabled,
  getWebhookFulfilmentGateEnabled: getCanadaRentalPaygWebhookFulfilmentEnabled,
  getPaymentPersistenceGateEnabled: getCanadaRentalPaygPaymentPersistenceEnabled,
  getEntitlementGrantGateEnabled: getCanadaRentalPaygEntitlementGrantEnabled,
  loadPricingRows: loadCanadaPricingRows,
  loadRoleContext: loadCanadaRuntimeRoleContext,
  resolveReadiness: resolveCanadaRentalPaygReadiness,
};

export async function getCanadaRentalPaygRuntimeEnabled(client?: CanadaRuntimeClient) {
  const settings = await getAppSettingsMap(
    [APP_SETTING_KEYS.canadaRentalPaygRuntimeEnabled],
    client as SupabaseClient | undefined
  );
  return parseAppSettingBool(settings.get(APP_SETTING_KEYS.canadaRentalPaygRuntimeEnabled), false);
}

export async function getCanadaRentalPaygListingUnlockEnabled(client?: CanadaRuntimeClient) {
  const settings = await getAppSettingsMap(
    [APP_SETTING_KEYS.canadaRentalPaygListingUnlockEnabled],
    client as SupabaseClient | undefined
  );
  return parseAppSettingBool(settings.get(APP_SETTING_KEYS.canadaRentalPaygListingUnlockEnabled), false);
}

export async function getCanadaRentalPaygCheckoutSessionCreationEnabled(client?: CanadaRuntimeClient) {
  const settings = await getAppSettingsMap(
    [APP_SETTING_KEYS.canadaRentalPaygCheckoutSessionCreationEnabled],
    client as SupabaseClient | undefined
  );
  return parseAppSettingBool(
    settings.get(APP_SETTING_KEYS.canadaRentalPaygCheckoutSessionCreationEnabled),
    false
  );
}

export async function getCanadaRentalPaygWebhookFulfilmentEnabled(client?: CanadaRuntimeClient) {
  const settings = await getAppSettingsMap(
    [APP_SETTING_KEYS.canadaRentalPaygWebhookFulfilmentEnabled],
    client as SupabaseClient | undefined
  );
  return parseAppSettingBool(
    settings.get(APP_SETTING_KEYS.canadaRentalPaygWebhookFulfilmentEnabled),
    false
  );
}

export async function getCanadaRentalPaygPaymentPersistenceEnabled(client?: CanadaRuntimeClient) {
  const settings = await getAppSettingsMap(
    [APP_SETTING_KEYS.canadaRentalPaygPaymentPersistenceEnabled],
    client as SupabaseClient | undefined
  );
  return parseAppSettingBool(
    settings.get(APP_SETTING_KEYS.canadaRentalPaygPaymentPersistenceEnabled),
    false
  );
}

export async function getCanadaRentalPaygEntitlementGrantEnabled(client?: CanadaRuntimeClient) {
  const settings = await getAppSettingsMap(
    [APP_SETTING_KEYS.canadaRentalPaygEntitlementGrantEnabled],
    client as SupabaseClient | undefined
  );
  return parseAppSettingBool(
    settings.get(APP_SETTING_KEYS.canadaRentalPaygEntitlementGrantEnabled),
    false
  );
}

export async function getCanadaRentalPaygRuntimeDiagnostics(
  client?: CanadaRuntimeClient
): Promise<CanadaRentalPaygRuntimeDiagnostics> {
  const settings = await getAppSettingsMap(
    [
      APP_SETTING_KEYS.canadaRentalPaygRuntimeEnabled,
      APP_SETTING_KEYS.canadaRentalPaygListingUnlockEnabled,
      APP_SETTING_KEYS.canadaRentalPaygCheckoutSessionCreationEnabled,
      APP_SETTING_KEYS.canadaRentalPaygWebhookFulfilmentEnabled,
      APP_SETTING_KEYS.canadaRentalPaygPaymentPersistenceEnabled,
      APP_SETTING_KEYS.canadaRentalPaygEntitlementGrantEnabled,
    ],
    client as SupabaseClient | undefined
  );
  const gateEnabled = parseAppSettingBool(
    settings.get(APP_SETTING_KEYS.canadaRentalPaygRuntimeEnabled),
    false
  );
  const listingUnlockGateEnabled = parseAppSettingBool(
    settings.get(APP_SETTING_KEYS.canadaRentalPaygListingUnlockEnabled),
    false
  );
  const checkoutSessionCreationGateEnabled = parseAppSettingBool(
    settings.get(APP_SETTING_KEYS.canadaRentalPaygCheckoutSessionCreationEnabled),
    false
  );
  const webhookFulfilmentGateEnabled = parseAppSettingBool(
    settings.get(APP_SETTING_KEYS.canadaRentalPaygWebhookFulfilmentEnabled),
    false
  );
  const paymentPersistenceGateEnabled = parseAppSettingBool(
    settings.get(APP_SETTING_KEYS.canadaRentalPaygPaymentPersistenceEnabled),
    false
  );
  const entitlementGrantGateEnabled = parseAppSettingBool(
    settings.get(APP_SETTING_KEYS.canadaRentalPaygEntitlementGrantEnabled),
    false
  );

  return {
    gateEnabled,
    listingUnlockGateEnabled,
    checkoutSessionCreationGateEnabled,
    webhookFulfilmentGateEnabled,
    paymentPersistenceGateEnabled,
    entitlementGrantGateEnabled,
    resolverAvailable: true,
    stripePrepLayerAvailable: true,
    stripeSessionRequestDefined: true,
    webhookContractDefined: true,
    paymentPersistenceContractDefined: true,
    entitlementGrantContractDefined: true,
    paymentPersistencePayloadDefined: true,
    entitlementGrantPayloadDefined: true,
    entitlementReadIntegrationAvailable: true,
    listingCapBypassDecisionDefined: true,
    entitlementConsumeContractDefined: true,
    fulfilmentPlanDefined: true,
    checkoutEnabled: false,
    checkoutCreationEnabled: checkoutSessionCreationGateEnabled,
    paymentRecoveryScaffolded: true,
    liveWebhookFulfilmentEnabled: webhookFulfilmentGateEnabled,
    fulfilmentExecutionEnabled:
      webhookFulfilmentGateEnabled &&
      paymentPersistenceGateEnabled &&
      entitlementGrantGateEnabled,
    fulfilmentMutationEnabled:
      webhookFulfilmentGateEnabled &&
      paymentPersistenceGateEnabled &&
      entitlementGrantGateEnabled,
    entitlementConsumeExecutionEnabled: false,
    entitlementConsumeMutationEnabled: false,
    listingSubmitAfterConsumeEnabled: false,
    listingUnlockEnabled: false,
    liveCapBypassEnabled: false,
    paymentRecordWriteEnabled: paymentPersistenceGateEnabled,
    runtimeSource: "legacy",
    nextActivationPrerequisites: [...CANADA_RENTAL_PAYG_RUNTIME_PREREQUISITES],
  };
}

export async function loadCanadaRentalPaygRuntimeDecision(
  input: CanadaRentalPaygRuntimeInput,
  deps: CanadaRentalPaygRuntimeDeps = defaultDeps
): Promise<CanadaRentalPaygRuntimeDecision> {
  const gateEnabled = await deps.getGateEnabled(input.serviceClient);
  const listingUnlockGateEnabled = await deps.getListingUnlockGateEnabled(input.serviceClient);
  const checkoutSessionCreationGateEnabled = await deps.getCheckoutSessionCreationGateEnabled(
    input.serviceClient
  );
  const webhookFulfilmentGateEnabled = await deps.getWebhookFulfilmentGateEnabled(
    input.serviceClient
  );
  const paymentPersistenceGateEnabled = await deps.getPaymentPersistenceGateEnabled(
    input.serviceClient
  );
  const entitlementGrantGateEnabled = await deps.getEntitlementGrantGateEnabled(
    input.serviceClient
  );
  const pricingRows = await deps.loadPricingRows(input.serviceClient);

  const needsRoleContext =
    input.role == null || input.tier == null || input.activeListingCount == null;
  const roleContext = needsRoleContext
    ? await deps.loadRoleContext({
        serviceClient: input.serviceClient,
        ownerId: input.ownerId,
        listingId: input.listingId ?? null,
      })
    : null;

  const readiness = deps.resolveReadiness({
    marketCountry: input.marketCountry,
    listingIntent: input.listingIntent,
    rentalType: input.rentalType,
    role: input.role ?? roleContext?.role ?? null,
    tier: input.tier ?? roleContext?.tier ?? null,
    activeListingCount: input.activeListingCount ?? roleContext?.activeListingCount ?? null,
    policies: pricingRows.policies,
    entitlements: pricingRows.entitlements,
    oneOffPrices: pricingRows.oneOffPrices,
  });

  return {
    gateEnabled,
    listingUnlockGateEnabled,
    checkoutSessionCreationGateEnabled,
    webhookFulfilmentGateEnabled,
    paymentPersistenceGateEnabled,
    entitlementGrantGateEnabled,
    marketCountry: readiness.marketCountry,
    runtimeSource: "legacy",
    resolverAvailable: true,
    stripePrepLayerAvailable: true,
    stripeSessionRequestDefined: true,
    webhookContractDefined: true,
    paymentPersistenceContractDefined: true,
    entitlementGrantContractDefined: true,
    paymentPersistencePayloadDefined: true,
    entitlementGrantPayloadDefined: true,
    entitlementReadIntegrationAvailable: true,
    listingCapBypassDecisionDefined: true,
    entitlementConsumeContractDefined: true,
    fulfilmentPlanDefined: true,
    checkoutEnabled: false,
    checkoutCreationEnabled: checkoutSessionCreationGateEnabled,
    paymentRecoveryScaffolded: true,
    liveWebhookFulfilmentEnabled: webhookFulfilmentGateEnabled,
    fulfilmentExecutionEnabled:
      webhookFulfilmentGateEnabled &&
      paymentPersistenceGateEnabled &&
      entitlementGrantGateEnabled,
    fulfilmentMutationEnabled:
      webhookFulfilmentGateEnabled &&
      paymentPersistenceGateEnabled &&
      entitlementGrantGateEnabled,
    entitlementConsumeExecutionEnabled: false,
    entitlementConsumeMutationEnabled: false,
    listingSubmitAfterConsumeEnabled: false,
    listingUnlockEnabled: false,
    liveCapBypassEnabled: false,
    paymentRecordWriteEnabled: paymentPersistenceGateEnabled,
    readiness,
    nextActivationPrerequisites: [...CANADA_RENTAL_PAYG_RUNTIME_PREREQUISITES],
  };
}
