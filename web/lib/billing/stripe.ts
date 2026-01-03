import Stripe from "stripe";
import type { ProviderMode } from "@/lib/billing/provider-settings";

const stripeClients: Record<string, Stripe> = {};

function resolveStripeSecretKey(mode?: ProviderMode | null) {
  const suffix = mode ? `_${mode.toUpperCase()}` : "";
  const modeKey = process.env[`STRIPE_SECRET_KEY${suffix}`];
  return modeKey || process.env.STRIPE_SECRET_KEY || null;
}

function resolveStripeWebhookSecret(mode?: ProviderMode | null) {
  const suffix = mode ? `_${mode.toUpperCase()}` : "";
  const modeSecret = process.env[`STRIPE_WEBHOOK_SECRET${suffix}`];
  return modeSecret || process.env.STRIPE_WEBHOOK_SECRET || null;
}

export function getStripeConfigForMode(mode?: ProviderMode | null) {
  const resolvedMode = mode === "live" ? "live" : "test";
  return {
    mode: resolvedMode as ProviderMode,
    secretKey: resolveStripeSecretKey(resolvedMode),
    webhookSecret: resolveStripeWebhookSecret(resolvedMode),
  };
}

export function getStripeClient(secretKey?: string | null) {
  const key = secretKey || process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  if (!stripeClients[key]) {
    stripeClients[key] = new Stripe(key, {
      apiVersion: "2024-06-20",
      typescript: true,
    });
  }
  return stripeClients[key];
}

export function getStripeWebhookSecret(secretOverride?: string | null) {
  const secret = secretOverride || process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }
  return secret;
}
