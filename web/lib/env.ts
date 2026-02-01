export const DEV_MOCKS =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_MOCKS === "true";

function normalizeBaseUrl(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

let loggedMissingPublicSiteUrl = false;

export function getEnvPresence() {
  return {
    NEXT_PUBLIC_SITE_URL: !!process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_ENABLE_DEV_MOCKS: process.env.NEXT_PUBLIC_ENABLE_DEV_MOCKS === "true",
    SITE_URL: !!process.env.SITE_URL,
    VERCEL_URL: !!process.env.VERCEL_URL,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    STRIPE_PRICE_LANDLORD_MONTHLY: !!process.env.STRIPE_PRICE_LANDLORD_MONTHLY,
    STRIPE_PRICE_LANDLORD_YEARLY: !!process.env.STRIPE_PRICE_LANDLORD_YEARLY,
    STRIPE_PRICE_AGENT_MONTHLY: !!process.env.STRIPE_PRICE_AGENT_MONTHLY,
    STRIPE_PRICE_AGENT_YEARLY: !!process.env.STRIPE_PRICE_AGENT_YEARLY,
    STRIPE_PRICE_TENANT_MONTHLY: !!process.env.STRIPE_PRICE_TENANT_MONTHLY,
    STRIPE_PRICE_TENANT_YEARLY: !!process.env.STRIPE_PRICE_TENANT_YEARLY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    RESEND_FROM: !!process.env.RESEND_FROM,
  };
}

function resolveConfiguredSiteUrl() {
  const siteUrl = normalizeBaseUrl(process.env.SITE_URL);
  if (siteUrl) return siteUrl;
  const publicUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (publicUrl) return publicUrl;
  const vercelUrl = process.env.VERCEL_URL
    ? normalizeBaseUrl(`https://${process.env.VERCEL_URL}`)
    : null;
  if (vercelUrl) return vercelUrl;
  return null;
}

export async function getApiBaseUrl() {
  const envUrl = resolveConfiguredSiteUrl();
  if (envUrl) return envUrl;

  if (process.env.NODE_ENV === "production") {
    if (!loggedMissingPublicSiteUrl) {
      console.error(
        "[env] SITE_URL is missing in production; set it to https://www.propatyhub.com. Falling back to relative API URLs."
      );
      loggedMissingPublicSiteUrl = true;
    }
    return "http://localhost:3000";
  }

  return "http://localhost:3000";
}

export async function getSiteUrl(options?: { allowFallback?: boolean }) {
  const envUrl = resolveConfiguredSiteUrl();
  if (envUrl) return envUrl;

  if (options?.allowFallback === false) return "";

  return "http://localhost:3000";
}

export async function getCanonicalBaseUrl() {
  return getSiteUrl();
}
