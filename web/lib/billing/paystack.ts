import type { ProviderMode, ProviderSettingsRow } from "@/lib/billing/provider-settings";
import { getProviderSettings, normalizeProviderMode } from "@/lib/billing/provider-settings";

export type PaystackConfig = {
  mode: ProviderMode;
  secretKey: string | null;
  publicKey: string | null;
  keyPresent: boolean;
  source: "db" | "env" | "missing";
  fallbackFromLive: boolean;
};

type ResolveInput = {
  mode: ProviderMode;
  settings?: ProviderSettingsRow | null;
  env?: NodeJS.ProcessEnv;
};

function resolveKeys(mode: ProviderMode, settings?: ProviderSettingsRow | null, env?: NodeJS.ProcessEnv) {
  const sourceEnv = env ?? process.env;
  const isLive = mode === "live";
  const dbSecret = isLive ? settings?.paystack_live_secret_key : settings?.paystack_test_secret_key;
  const dbPublic = isLive ? settings?.paystack_live_public_key : settings?.paystack_test_public_key;
  const envSecret = sourceEnv[isLive ? "PAYSTACK_SECRET_KEY_LIVE" : "PAYSTACK_SECRET_KEY_TEST"] || sourceEnv.PAYSTACK_SECRET_KEY;
  const envPublic = sourceEnv[isLive ? "PAYSTACK_PUBLIC_KEY_LIVE" : "PAYSTACK_PUBLIC_KEY_TEST"] || sourceEnv.PAYSTACK_PUBLIC_KEY;
  const secretKey = dbSecret || envSecret || null;
  const publicKey = dbPublic || envPublic || null;
  const source: PaystackConfig["source"] = dbSecret
    ? "db"
    : envSecret
    ? "env"
    : "missing";

  return { secretKey, publicKey, source };
}

export function resolvePaystackConfig({ mode, settings, env }: ResolveInput): PaystackConfig {
  const requestedMode = normalizeProviderMode(mode);
  const resolved = resolveKeys(requestedMode, settings, env);

  if (requestedMode === "live" && !resolved.secretKey) {
    const fallback = resolveKeys("test", settings, env);
    return {
      mode: "test",
      secretKey: fallback.secretKey,
      publicKey: fallback.publicKey,
      keyPresent: !!fallback.secretKey,
      source: fallback.source,
      fallbackFromLive: true,
    };
  }

  return {
    mode: requestedMode,
    secretKey: resolved.secretKey,
    publicKey: resolved.publicKey,
    keyPresent: !!resolved.secretKey,
    source: resolved.source,
    fallbackFromLive: false,
  };
}

export async function getPaystackConfig(mode: ProviderMode): Promise<PaystackConfig> {
  const settings = await getProviderSettings();
  return resolvePaystackConfig({ mode, settings });
}
