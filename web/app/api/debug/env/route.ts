import { NextResponse } from "next/server";
import { getProviderModes, getProviderSettings } from "@/lib/billing/provider-settings";
import { resolvePaystackServerConfig } from "@/lib/billing/paystack";

export async function GET() {
  const providerModes = await getProviderModes();
  const providerSettings = await getProviderSettings();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET;
  const openai = process.env.OPENAI_API_KEY || process.env.OPENAI_APT_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeBillingWebhook = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  const stripeShortletWebhook = process.env.STRIPE_SHORTLET_WEBHOOK_SECRET;
  const stripePublishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripeLandlordMonthly = process.env.STRIPE_PRICE_LANDLORD_MONTHLY;
  const stripeLandlordYearly = process.env.STRIPE_PRICE_LANDLORD_YEARLY;
  const stripeAgentMonthly = process.env.STRIPE_PRICE_AGENT_MONTHLY;
  const stripeAgentYearly = process.env.STRIPE_PRICE_AGENT_YEARLY;
  const stripeTenantMonthly = process.env.STRIPE_PRICE_TENANT_MONTHLY;
  const stripeTenantYearly = process.env.STRIPE_PRICE_TENANT_YEARLY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  const hasEnvForMode = (key: string, mode: string) => {
    const suffix = `_${mode.toUpperCase()}`;
    return !!process.env[`${key}${suffix}`] || !!process.env[key];
  };
  const hasAnyEnvForMode = (keys: string[], mode: string) => keys.some((key) => hasEnvForMode(key, mode));
  const subscriptionCurrencies = ["GBP", "NGN", "CAD"];
  const subscriptionRoles = ["LANDLORD", "AGENT", "TENANT"] as const;
  const subscriptionCadences = ["MONTHLY", "YEARLY"] as const;
  const subscriptionTierKeyCandidates = (role: string, cadence: string, currency?: string) => {
    const suffix = currency ? `_${currency}` : "";
    if (role === "TENANT") {
      return [
        `STRIPE_PRICE_TENANT_TENANT_PRO_${cadence}${suffix}`,
        `STRIPE_PRICE_TENANT_${cadence}${suffix}`,
      ];
    }
    return [
      `STRIPE_PRICE_${role}_PRO_${cadence}${suffix}`,
      `STRIPE_PRICE_${role}_STARTER_${cadence}${suffix}`,
      `STRIPE_PRICE_${role}_${cadence}${suffix}`,
    ];
  };
  const stripeMarketPriceMatrix = Object.fromEntries(
    subscriptionCurrencies.map((currency) => [
      currency,
      Object.fromEntries(
        subscriptionRoles.map((role) => [
          role.toLowerCase(),
          Object.fromEntries(
            subscriptionCadences.map((cadence) => {
              const candidateKeys = subscriptionTierKeyCandidates(role, cadence, currency);
              return [
                cadence.toLowerCase(),
                {
                  configured: hasAnyEnvForMode(candidateKeys, providerModes.stripeMode),
                  keys: candidateKeys,
                },
              ];
            })
          ),
        ])
      ),
    ])
  );

  const hasStripeWebhookEnvForScope = (scope: "billing" | "shortlet", mode: string) => {
    const prefix =
      scope === "shortlet" ? "STRIPE_SHORTLET_WEBHOOK_SECRET" : "STRIPE_BILLING_WEBHOOK_SECRET";
    const suffix = `_${mode.toUpperCase()}`;
    return (
      !!process.env[`${prefix}${suffix}`] ||
      !!process.env[prefix] ||
      !!process.env[`STRIPE_WEBHOOK_SECRET${suffix}`] ||
      !!process.env.STRIPE_WEBHOOK_SECRET
    );
  };

  const required = [
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET",
  ];
  const missing = required.filter((key) => !process.env[key]);
  const stripeMissing = [
    ...["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"].filter(
      (key) => !hasEnvForMode(key, providerModes.stripeMode)
    ),
    ...[
      "STRIPE_PRICE_LANDLORD_MONTHLY",
      "STRIPE_PRICE_LANDLORD_YEARLY",
      "STRIPE_PRICE_AGENT_MONTHLY",
      "STRIPE_PRICE_AGENT_YEARLY",
      "STRIPE_PRICE_TENANT_MONTHLY",
      "STRIPE_PRICE_TENANT_YEARLY",
    ].filter((baseKey) => {
      const role = baseKey.split("_")[2];
      const cadence = baseKey.split("_")[3];
      if (hasAnyEnvForMode(subscriptionTierKeyCandidates(role, cadence), providerModes.stripeMode)) return false;
      return !subscriptionCurrencies.some((currency) =>
        hasAnyEnvForMode(subscriptionTierKeyCandidates(role, cadence, currency), providerModes.stripeMode)
      );
    }),
  ];
  const paystackConfig = resolvePaystackServerConfig({
    mode: providerModes.paystackMode,
    settings: providerSettings,
  });

  return NextResponse.json({
    supabaseUrl: !!supabaseUrl,
    supabaseAnon: !!supabaseAnon,
    storageBucket: !!storageBucket,
    openai: !!openai,
    siteUrl: !!siteUrl,
    providerModes,
    providerSettings: {
      paystackTestSecret: !!providerSettings?.paystack_test_secret_key,
      paystackLiveSecret: !!providerSettings?.paystack_live_secret_key,
      paystackTestPublic: !!providerSettings?.paystack_test_public_key,
      paystackLivePublic: !!providerSettings?.paystack_live_public_key,
      flutterwaveTestSecret: !!providerSettings?.flutterwave_test_secret_key,
      flutterwaveLiveSecret: !!providerSettings?.flutterwave_live_secret_key,
      flutterwaveTestPublic: !!providerSettings?.flutterwave_test_public_key,
      flutterwaveLivePublic: !!providerSettings?.flutterwave_live_public_key,
    },
    stripe: {
      mode: providerModes.stripeMode,
      secret: !!stripeSecret,
      secretTest: !!process.env.STRIPE_SECRET_KEY_TEST,
      secretLive: !!process.env.STRIPE_SECRET_KEY_LIVE,
      webhook: !!stripeWebhook,
      webhookTest: !!process.env.STRIPE_WEBHOOK_SECRET_TEST,
      webhookLive: !!process.env.STRIPE_WEBHOOK_SECRET_LIVE,
      billingWebhook: !!stripeBillingWebhook,
      billingWebhookTest: !!process.env.STRIPE_BILLING_WEBHOOK_SECRET_TEST,
      billingWebhookLive: !!process.env.STRIPE_BILLING_WEBHOOK_SECRET_LIVE,
      shortletWebhook: !!stripeShortletWebhook,
      shortletWebhookTest: !!process.env.STRIPE_SHORTLET_WEBHOOK_SECRET_TEST,
      shortletWebhookLive: !!process.env.STRIPE_SHORTLET_WEBHOOK_SECRET_LIVE,
      billingWebhookReadyForMode: hasStripeWebhookEnvForScope("billing", providerModes.stripeMode),
      shortletWebhookReadyForMode: hasStripeWebhookEnvForScope("shortlet", providerModes.stripeMode),
      publishable: !!stripePublishable,
      landlordMonthly: !!stripeLandlordMonthly,
      landlordYearly: !!stripeLandlordYearly,
      landlordMonthlyTest: !!process.env.STRIPE_PRICE_LANDLORD_MONTHLY_TEST,
      landlordMonthlyLive: !!process.env.STRIPE_PRICE_LANDLORD_MONTHLY_LIVE,
      landlordYearlyTest: !!process.env.STRIPE_PRICE_LANDLORD_YEARLY_TEST,
      landlordYearlyLive: !!process.env.STRIPE_PRICE_LANDLORD_YEARLY_LIVE,
      agentMonthly: !!stripeAgentMonthly,
      agentYearly: !!stripeAgentYearly,
      agentMonthlyTest: !!process.env.STRIPE_PRICE_AGENT_MONTHLY_TEST,
      agentMonthlyLive: !!process.env.STRIPE_PRICE_AGENT_MONTHLY_LIVE,
      agentYearlyTest: !!process.env.STRIPE_PRICE_AGENT_YEARLY_TEST,
      agentYearlyLive: !!process.env.STRIPE_PRICE_AGENT_YEARLY_LIVE,
      tenantMonthly: !!stripeTenantMonthly,
      tenantYearly: !!stripeTenantYearly,
      tenantMonthlyTest: !!process.env.STRIPE_PRICE_TENANT_MONTHLY_TEST,
      tenantMonthlyLive: !!process.env.STRIPE_PRICE_TENANT_MONTHLY_LIVE,
      tenantYearlyTest: !!process.env.STRIPE_PRICE_TENANT_YEARLY_TEST,
      tenantYearlyLive: !!process.env.STRIPE_PRICE_TENANT_YEARLY_LIVE,
      marketPriceMatrix: stripeMarketPriceMatrix,
      missing: stripeMissing,
    },
    paystack: {
      mode: providerModes.paystackMode,
      secret: !!process.env.PAYSTACK_SECRET_KEY,
      public: !!process.env.PAYSTACK_PUBLIC_KEY,
      secretTest: !!process.env.PAYSTACK_SECRET_KEY_TEST,
      secretLive: !!process.env.PAYSTACK_SECRET_KEY_LIVE,
      publicTest: !!process.env.PAYSTACK_PUBLIC_KEY_TEST,
      publicLive: !!process.env.PAYSTACK_PUBLIC_KEY_LIVE,
      webhook: !!process.env.PAYSTACK_WEBHOOK_SECRET,
      webhookTest: !!process.env.PAYSTACK_WEBHOOK_SECRET_TEST,
      webhookLive: !!process.env.PAYSTACK_WEBHOOK_SECRET_LIVE,
      effectiveMode: paystackConfig.mode,
      effectiveKeyPresent: paystackConfig.keyPresent,
      effectiveSource: paystackConfig.source,
      fallbackFromLive: paystackConfig.fallbackFromLive,
      webhookSource: paystackConfig.webhookSource,
    },
    flutterwave: {
      mode: providerModes.flutterwaveMode,
      secret: !!process.env.FLUTTERWAVE_SECRET_KEY,
      public: !!process.env.FLUTTERWAVE_PUBLIC_KEY,
      secretTest: !!process.env.FLUTTERWAVE_SECRET_KEY_TEST,
      secretLive: !!process.env.FLUTTERWAVE_SECRET_KEY_LIVE,
      publicTest: !!process.env.FLUTTERWAVE_PUBLIC_KEY_TEST,
      publicLive: !!process.env.FLUTTERWAVE_PUBLIC_KEY_LIVE,
    },
    email: {
      resendApiKey: !!resendApiKey,
      resendFrom: !!resendFrom,
    },
    push: {
      vapidPublicKey: !!vapidPublic,
      vapidPrivateKey: !!vapidPrivate,
      vapidSubject: !!vapidSubject,
      enabled: !!vapidPublic && !!vapidPrivate,
    },
    missing,
    runtime: process.env.VERCEL ? "vercel" : "local",
  });
}
