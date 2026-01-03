import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

export type ProviderMode = "test" | "live";

export type ProviderModes = {
  stripeMode: ProviderMode;
  paystackMode: ProviderMode;
  flutterwaveMode: ProviderMode;
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
    const row = data as {
      stripe_mode?: string | null;
      paystack_mode?: string | null;
      flutterwave_mode?: string | null;
    } | null;
    return {
      stripeMode: normalizeProviderMode(row?.stripe_mode),
      paystackMode: normalizeProviderMode(row?.paystack_mode),
      flutterwaveMode: normalizeProviderMode(row?.flutterwave_mode),
    };
  } catch {
    return DEFAULT_MODES;
  }
}
