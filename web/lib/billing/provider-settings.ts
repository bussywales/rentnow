import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

export type ProviderMode = "test" | "live";

export type ProviderModes = {
  stripeMode: ProviderMode;
  paystackMode: ProviderMode;
  flutterwaveMode: ProviderMode;
};

export type ProviderSettingsRow = {
  stripe_mode?: string | null;
  paystack_mode?: string | null;
  flutterwave_mode?: string | null;
  paystack_test_secret_key?: string | null;
  paystack_live_secret_key?: string | null;
  paystack_test_public_key?: string | null;
  paystack_live_public_key?: string | null;
  flutterwave_test_secret_key?: string | null;
  flutterwave_live_secret_key?: string | null;
  flutterwave_test_public_key?: string | null;
  flutterwave_live_public_key?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

const DEFAULT_MODES: ProviderModes = {
  stripeMode: "test",
  paystackMode: "test",
  flutterwaveMode: "test",
};

export function normalizeProviderMode(value?: string | null): ProviderMode {
  return value === "live" ? "live" : "test";
}

export async function getProviderModes(): Promise<ProviderModes> {
  if (!hasServiceRoleEnv()) return DEFAULT_MODES;
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from("provider_settings")
      .select("stripe_mode, paystack_mode, flutterwave_mode")
      .eq("id", "default")
      .maybeSingle();
    const row = data as ProviderSettingsRow | null;
    return {
      stripeMode: normalizeProviderMode(row?.stripe_mode),
      paystackMode: normalizeProviderMode(row?.paystack_mode),
      flutterwaveMode: normalizeProviderMode(row?.flutterwave_mode),
    };
  } catch {
    return DEFAULT_MODES;
  }
}

export async function getProviderSettings(): Promise<ProviderSettingsRow | null> {
  if (!hasServiceRoleEnv()) return null;
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from("provider_settings")
      .select(
        "stripe_mode, paystack_mode, flutterwave_mode, paystack_test_secret_key, paystack_live_secret_key, paystack_test_public_key, paystack_live_public_key, flutterwave_test_secret_key, flutterwave_live_secret_key, flutterwave_test_public_key, flutterwave_live_public_key, updated_at, updated_by"
      )
      .eq("id", "default")
      .maybeSingle();
    return (data as ProviderSettingsRow | null) ?? null;
  } catch {
    return null;
  }
}
