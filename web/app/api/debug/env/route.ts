import { NextResponse } from "next/server";

export async function GET() {
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
  const stripeMissing = stripeRequired.filter((key) => !process.env[key]);

  return NextResponse.json({
    supabaseUrl: !!supabaseUrl,
    supabaseAnon: !!supabaseAnon,
    storageBucket: !!storageBucket,
    openai: !!openai,
    siteUrl: !!siteUrl,
    stripe: {
      secret: !!stripeSecret,
      webhook: !!stripeWebhook,
      publishable: !!stripePublishable,
      landlordMonthly: !!stripeLandlordMonthly,
      landlordYearly: !!stripeLandlordYearly,
      agentMonthly: !!stripeAgentMonthly,
      agentYearly: !!stripeAgentYearly,
      tenantMonthly: !!stripeTenantMonthly,
      tenantYearly: !!stripeTenantYearly,
      missing: stripeMissing,
    },
    email: {
      resendApiKey: !!resendApiKey,
      resendFrom: !!resendFrom,
    },
    missing,
    runtime: process.env.VERCEL ? "vercel" : "local",
  });
}
