import { NextResponse } from "next/server";
import { getProviderModes } from "@/lib/billing/provider-settings";

export async function GET() {
  const providerModes = await getProviderModes();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET;
  const openai = process.env.OPENAI_API_KEY || process.env.OPENAI_APT_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET;
  const stripePublishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripeLandlordMonthly = process.env.STRIPE_PRICE_LANDLORD_MONTHLY;
  const stripeLandlordYearly = process.env.STRIPE_PRICE_LANDLORD_YEARLY;
  const stripeAgentMonthly = process.env.STRIPE_PRICE_AGENT_MONTHLY;
  const stripeAgentYearly = process.env.STRIPE_PRICE_AGENT_YEARLY;
  const stripeTenantMonthly = process.env.STRIPE_PRICE_TENANT_MONTHLY;
  const stripeTenantYearly = process.env.STRIPE_PRICE_TENANT_YEARLY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;

  const hasEnvForMode = (key: string, mode: string) => {
    const suffix = `_${mode.toUpperCase()}`;
    return !!process.env[`${key}${suffix}`] || !!process.env[key];
  };

  const required = [
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET",
  ];
  const missing = required.filter((key) => !process.env[key]);
  const stripeRequired = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_LANDLORD_MONTHLY",
    "STRIPE_PRICE_LANDLORD_YEARLY",
    "STRIPE_PRICE_AGENT_MONTHLY",
    "STRIPE_PRICE_AGENT_YEARLY",
    "STRIPE_PRICE_TENANT_MONTHLY",
    "STRIPE_PRICE_TENANT_YEARLY",
  ];
  const stripeMissing = stripeRequired.filter(
    (key) => !hasEnvForMode(key, providerModes.stripeMode)
  );

  return NextResponse.json({
    supabaseUrl: !!supabaseUrl,
    supabaseAnon: !!supabaseAnon,
    storageBucket: !!storageBucket,
    openai: !!openai,
    siteUrl: !!siteUrl,
    providerModes,
    stripe: {
      mode: providerModes.stripeMode,
      secret: !!stripeSecret,
      secretTest: !!process.env.STRIPE_SECRET_KEY_TEST,
      secretLive: !!process.env.STRIPE_SECRET_KEY_LIVE,
      webhook: !!stripeWebhook,
      webhookTest: !!process.env.STRIPE_WEBHOOK_SECRET_TEST,
      webhookLive: !!process.env.STRIPE_WEBHOOK_SECRET_LIVE,
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
    missing,
    runtime: process.env.VERCEL ? "vercel" : "local",
  });
}
