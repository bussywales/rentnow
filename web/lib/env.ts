export const DEV_MOCKS =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_MOCKS === "true";

let loggedServerSupabaseUrlFallback = false;
let loggedServerSupabaseAnonKeyFallback = false;

export function resetServerSupabaseEnvWarningsForTest() {
  if (process.env.NODE_ENV !== "test") return;
  loggedServerSupabaseUrlFallback = false;
  loggedServerSupabaseAnonKeyFallback = false;
}

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

function missingSiteUrlError() {
  return new Error(
    "[env] Missing SITE_URL or NEXT_PUBLIC_SITE_URL in production. Refusing to fall back to localhost."
  );
}

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
    SENTRY_DSN: !!process.env.SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_DSN: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    SENTRY_AUTH_TOKEN: !!process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: !!process.env.SENTRY_ORG,
    SENTRY_PROJECT: !!process.env.SENTRY_PROJECT,
    SENTRY_RELEASE: !!process.env.SENTRY_RELEASE,
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

function warnServerSupabaseFallback(serverKey: string, fallbackKey: string) {
  if (serverKey === "SUPABASE_URL" && !loggedServerSupabaseUrlFallback) {
    console.warn(
      `[env] ${serverKey} is missing; server-side Supabase code is falling back to ${fallbackKey}. Define ${serverKey} explicitly to avoid ambiguous runtime config.`
    );
    loggedServerSupabaseUrlFallback = true;
    return;
  }

  if (serverKey === "SUPABASE_ANON_KEY" && !loggedServerSupabaseAnonKeyFallback) {
    console.warn(
      `[env] ${serverKey} is missing; server-side Supabase code is falling back to ${fallbackKey}. Define ${serverKey} explicitly to avoid ambiguous runtime config.`
    );
    loggedServerSupabaseAnonKeyFallback = true;
  }
}

function resolveServerSupabaseValue(serverKey: string, fallbackKey: string) {
  const serverValue = process.env[serverKey]?.trim();
  if (serverValue) return serverValue;

  const fallbackValue = process.env[fallbackKey]?.trim();
  if (fallbackValue) {
    warnServerSupabaseFallback(serverKey, fallbackKey);
    return fallbackValue;
  }

  return null;
}

export function getServerSupabaseEnv() {
  const url = resolveServerSupabaseValue("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = resolveServerSupabaseValue("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getServerSupabaseUrl() {
  return resolveServerSupabaseValue("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
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
    const error = missingSiteUrlError();
    if (!loggedMissingPublicSiteUrl) {
      console.error(error.message);
      loggedMissingPublicSiteUrl = true;
    }
    throw error;
  }

  return "http://localhost:3000";
}

export async function getSiteUrl(options?: { allowFallback?: boolean }) {
  const envUrl = resolveConfiguredSiteUrl();
  if (envUrl) return envUrl;

  if (process.env.NODE_ENV === "production") {
    const error = missingSiteUrlError();
    if (!loggedMissingPublicSiteUrl) {
      console.error(error.message);
      loggedMissingPublicSiteUrl = true;
    }
    throw error;
  }

  if (options?.allowFallback === false) return "";

  return "http://localhost:3000";
}

export async function getCanonicalBaseUrl() {
  return getSiteUrl();
}
