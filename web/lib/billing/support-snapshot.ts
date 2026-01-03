import { maskEmail, maskIdentifier } from "@/lib/billing/mask";
import type { BillingSnapshot } from "@/lib/billing/snapshot";

type SupportEvent = {
  event_type: string | null;
  status: string | null;
  reason: string | null;
  mode: string | null;
  created_at: string | null;
  processed_at: string | null;
  event_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

export function buildSupportSnapshot(input: {
  snapshot: BillingSnapshot;
  openUpgradeRequests: number;
  events: SupportEvent[];
}) {
  const { snapshot, openUpgradeRequests, events } = input;
  return {
    profile_id: maskIdentifier(snapshot.profileId),
    email: maskEmail(snapshot.email),
    role: snapshot.role,
    plan_tier: snapshot.planTier,
    billing_source: snapshot.billingSource,
    valid_until: snapshot.validUntil,
    stripe_status: snapshot.stripeStatus,
    stripe_customer_id: snapshot.stripeCustomerId,
    stripe_subscription_id: snapshot.stripeSubscriptionId,
    open_upgrade_requests: openUpgradeRequests,
    recent_events: events.slice(0, 3).map((event) => ({
      event_type: event.event_type,
      status: event.status,
      reason: event.reason,
      mode: event.mode,
      created_at: event.created_at,
      processed_at: event.processed_at,
      event_id: maskIdentifier(event.event_id ?? null),
      stripe_customer_id: maskIdentifier(event.stripe_customer_id ?? null),
      stripe_subscription_id: maskIdentifier(event.stripe_subscription_id ?? null),
    })),
  };
}
