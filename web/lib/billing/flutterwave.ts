import type { ProviderMode, ProviderSettingsRow } from "@/lib/billing/provider-settings";
import { getProviderSettings, normalizeProviderMode } from "@/lib/billing/provider-settings";

export type FlutterwaveConfig = {
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
  const dbSecret = isLive ? settings?.flutterwave_live_secret_key : settings?.flutterwave_test_secret_key;
  const dbPublic = isLive ? settings?.flutterwave_live_public_key : settings?.flutterwave_test_public_key;
  const envSecret =
    sourceEnv[isLive ? "FLUTTERWAVE_SECRET_KEY_LIVE" : "FLUTTERWAVE_SECRET_KEY_TEST"] ||
    sourceEnv.FLUTTERWAVE_SECRET_KEY;
  const envPublic =
    sourceEnv[isLive ? "FLUTTERWAVE_PUBLIC_KEY_LIVE" : "FLUTTERWAVE_PUBLIC_KEY_TEST"] ||
    sourceEnv.FLUTTERWAVE_PUBLIC_KEY;
  const secretKey = dbSecret || envSecret || null;
  const publicKey = dbPublic || envPublic || null;
  const source: FlutterwaveConfig["source"] = dbSecret
    ? "db"
    : envSecret
    ? "env"
    : "missing";

  return { secretKey, publicKey, source };
}

export function resolveFlutterwaveConfig({ mode, settings, env }: ResolveInput): FlutterwaveConfig {
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

export async function getFlutterwaveConfig(mode: ProviderMode): Promise<FlutterwaveConfig> {
  const settings = await getProviderSettings();
  return resolveFlutterwaveConfig({ mode, settings });
}
