import type { BillingPlanRow, BillingSnapshot } from "@/lib/billing/snapshot";

export type BillingSubscriptionRow = {
  provider?: string | null;
  provider_subscription_id?: string | null;
  status?: string | null;
  plan_tier?: string | null;
  role?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  canceled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BillingStripeEventRow = {
  event_id?: string | null;
  event_type?: string | null;
  created_at?: string | null;
  status?: string | null;
  reason?: string | null;
  mode?: string | null;
  plan_tier?: string | null;
  profile_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  processed_at?: string | null;
  replay_count?: number | null;
  last_replay_at?: string | null;
  last_replay_status?: string | null;
  last_replay_reason?: string | null;
};

export type BillingDiagnosticSeverity = "info" | "warn" | "error";

export type BillingDiagnosticItem = {
  key: string;
  severity: BillingDiagnosticSeverity;
  title: string;
  description: string;
};

export type BillingTimelineItem = {
  key: string;
  timestamp: string | null;
  severity: BillingDiagnosticSeverity;
  title: string;
  description: string;
};

export type BillingOpsDiagnostics = {
  hasStoredStripeTruth: boolean;
  hasProviderSubscription: boolean;
  manualOverrideMasksProviderTruth: boolean;
  stateMatchesProviderTruth: boolean;
  hasIdentityMismatch: boolean;
  replayEligibleEventCount: number;
  ignoredEventCount: number;
  missingProfileAttachEventCount: number;
  mismatchProfileIds: string[];
  diagnostics: BillingDiagnosticItem[];
  timeline: BillingTimelineItem[];
  providerSubscription: BillingSubscriptionRow | null;
};

function compareDates(left?: string | null, right?: string | null) {
  return (left ?? null) === (right ?? null);
}

function compareText(left?: string | null, right?: string | null) {
  return (left ?? null) === (right ?? null);
}

function sortByMostRecent<T extends { current_period_end?: string | null; updated_at?: string | null; created_at?: string | null }>(
  rows: T[]
) {
  return [...rows].sort((a, b) => {
    const left =
      Date.parse(a.current_period_end ?? "") ||
      Date.parse(a.updated_at ?? "") ||
      Date.parse(a.created_at ?? "") ||
      0;
    const right =
      Date.parse(b.current_period_end ?? "") ||
      Date.parse(b.updated_at ?? "") ||
      Date.parse(b.created_at ?? "") ||
      0;
    return right - left;
  });
}

export function isReplayEligibleStripeEvent(event: BillingStripeEventRow) {
  const status = event.status ?? "received";
  return status !== "processed" && status !== "ok";
}

function describeWebhookReason(reason?: string | null) {
  switch (reason) {
    case "missing_plan_mapping":
      return "Stripe received the payment, but the price id did not map to a PropatyHub subscription plan.";
    case "manual_override":
      return "Webhook processing stopped because a manual billing override was active on the account.";
    case "duplicate_update":
      return "Webhook processing skipped because the account already matched the incoming provider state.";
    case "missing_profile_attach":
      return "Webhook processing could not attach the payment to an internal profile.";
    case "identity_mismatch":
      return "Stripe event metadata pointed to a different profile than the one currently loaded.";
    default:
      return reason ? `Webhook outcome: ${reason}.` : "Webhook outcome recorded without an explicit reason.";
  }
}

function parseNotesTimeline(notes: string | null): BillingTimelineItem[] {
  if (!notes) return [];

  return notes.split("\n").reduce<BillingTimelineItem[]>((items, line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return items;
      const match = trimmed.match(/^\[(.+?)\]\s*(.+)$/);
      items.push({
        key: `note-${index}`,
        timestamp: match?.[1] ?? null,
        severity: "info" as const,
        title: "Billing note",
        description: match?.[2] ?? trimmed,
      });
      return items;
    }, []);
}

export function buildBillingOpsDiagnostics(input: {
  snapshot: BillingSnapshot;
  plan: BillingPlanRow | null;
  subscriptionRows: BillingSubscriptionRow[];
  events: BillingStripeEventRow[];
  billingNotes: string | null;
}): BillingOpsDiagnostics {
  const subscriptionRows = sortByMostRecent(input.subscriptionRows);
  const providerSubscription =
    subscriptionRows.find((row) =>
      ["active", "trialing", "past_due", "unpaid", "canceled"].includes(row.status ?? "")
    ) ?? subscriptionRows[0] ?? null;

  const events = [...input.events].sort((a, b) => {
    const left = Date.parse(a.created_at ?? "") || 0;
    const right = Date.parse(b.created_at ?? "") || 0;
    return right - left;
  });

  const mismatchProfileIds = Array.from(
    new Set(
      events
        .map((event) => event.profile_id ?? null)
        .filter((profileId): profileId is string => Boolean(profileId && profileId !== input.snapshot.profileId))
    )
  );

  const hasProviderSubscription = Boolean(providerSubscription);
  const hasStoredStripeTruth =
    input.snapshot.stripeCustomerIdPresent ||
    input.snapshot.stripeSubscriptionIdPresent ||
    input.snapshot.stripePriceIdPresent ||
    hasProviderSubscription ||
    events.some(
      (event) => Boolean(event.stripe_customer_id || event.stripe_subscription_id || event.stripe_price_id)
    );

  const manualOverrideMasksProviderTruth =
    input.snapshot.manualOverrideActive &&
    (hasProviderSubscription ||
      Boolean(input.snapshot.stripeCustomerIdPresent || input.snapshot.stripeSubscriptionIdPresent));

  const stateMatchesProviderTruth = !providerSubscription
    ? !manualOverrideMasksProviderTruth
    : compareText(input.snapshot.billingSource, providerSubscription.provider) &&
      compareText(input.snapshot.effectivePlanTier, providerSubscription.plan_tier) &&
      compareText(input.snapshot.stripeStatus, providerSubscription.status) &&
      compareDates(input.snapshot.validUntil, providerSubscription.current_period_end);

  const ignoredEvents = events.filter((event) => event.status === "ignored");
  const missingProfileAttachEventCount = events.filter(
    (event) =>
      !event.profile_id && Boolean(event.stripe_customer_id || event.stripe_subscription_id || event.stripe_price_id)
  ).length;

  const diagnostics: BillingDiagnosticItem[] = [];

  if (manualOverrideMasksProviderTruth) {
    diagnostics.push({
      key: "manual-override-masks-provider",
      severity: "error",
      title: "Manual override is masking provider-owned Stripe state",
      description:
        "This account is currently showing manual billing, but stored Stripe truth exists underneath. Use recovery only if the underlying Stripe subscription is the intended source of truth.",
    });
  }

  if (hasProviderSubscription && !stateMatchesProviderTruth) {
    diagnostics.push({
      key: "provider-state-mismatch",
      severity: "warn",
      title: "App-visible plan state does not match stored provider subscription truth",
      description:
        "The latest subscriptions row does not line up with profile_plans. This usually means webhook processing was skipped, manual override remained active, or the profile plan was not refreshed after provider recovery.",
    });
  }

  if (ignoredEvents.length > 0) {
    diagnostics.push({
      key: "ignored-webhooks",
      severity: "warn",
      title: "Recent Stripe webhook events were ignored",
      description: ignoredEvents
        .slice(0, 3)
        .map((event) => describeWebhookReason(event.reason))
        .join(" "),
    });
  }

  if (missingProfileAttachEventCount > 0) {
    diagnostics.push({
      key: "missing-profile-attach",
      severity: "error",
      title: "Webhook events exist without an attached internal profile",
      description:
        "Stripe events were recorded, but no internal profile was attached. This needs replay or identity correction before the account state will update.",
    });
  }

  if (mismatchProfileIds.length > 0) {
    diagnostics.push({
      key: "identity-mismatch",
      severity: "error",
      title: "Recent billing events reference a different profile id",
      description: `Loaded profile ${input.snapshot.profileId} does not match all recent billing events. Conflicting profile ids: ${mismatchProfileIds.join(", ")}.`,
    });
  }

  if (!diagnostics.length) {
    diagnostics.push({
      key: "healthy",
      severity: "info",
      title: "No active billing conflicts detected",
      description:
        "Current plan state, provider truth, and recent webhook outcomes are aligned for the loaded account.",
    });
  }

  const timeline: BillingTimelineItem[] = [];

  if (input.plan?.updated_at) {
    timeline.push({
      key: "plan-updated",
      timestamp: input.plan.updated_at,
      severity: input.snapshot.manualOverrideActive ? "warn" : "info",
      title: "Profile plan updated",
      description: `billing_source=${input.snapshot.billingSource}, plan_tier=${input.snapshot.planTier}`,
    });
  }

  if (input.plan?.upgraded_at) {
    timeline.push({
      key: "plan-upgraded",
      timestamp: input.plan.upgraded_at,
      severity: "info",
      title: "Plan upgrade stamp",
      description: `Last upgraded record shows plan_tier=${input.snapshot.planTier}.`,
    });
  }

  if (providerSubscription) {
    timeline.push({
      key: "provider-subscription",
      timestamp: providerSubscription.updated_at ?? providerSubscription.created_at ?? null,
      severity: "info",
      title: "Latest provider subscription row",
      description: `${providerSubscription.provider ?? "provider"} ${providerSubscription.status ?? "unknown"} • ${providerSubscription.plan_tier ?? "—"} • period end ${providerSubscription.current_period_end ?? "—"}`,
    });
  }

  events.slice(0, 10).forEach((event) => {
    timeline.push({
      key: `event-${event.event_id ?? event.created_at ?? Math.random().toString(36)}`,
      timestamp: event.created_at ?? null,
      severity:
        event.status === "processed"
          ? "info"
          : event.status === "ignored"
          ? "warn"
          : "error",
      title: `Stripe webhook ${event.event_type ?? "event"}`,
      description: `${event.status ?? "received"}${event.reason ? ` • ${event.reason}` : ""}${event.replay_count ? ` • replayed ${event.replay_count}x` : ""}`,
    });

    if (event.last_replay_at) {
      timeline.push({
        key: `replay-${event.event_id ?? event.last_replay_at}`,
        timestamp: event.last_replay_at,
        severity: event.last_replay_status === "failed" ? "error" : "info",
        title: "Stripe replay attempt",
        description: `${event.last_replay_status ?? "replayed"}${event.last_replay_reason ? ` • ${event.last_replay_reason}` : ""}`,
      });
    }
  });

  timeline.push(...parseNotesTimeline(input.billingNotes));

  timeline.sort((a, b) => {
    const left = Date.parse(a.timestamp ?? "") || 0;
    const right = Date.parse(b.timestamp ?? "") || 0;
    return right - left;
  });

  return {
    hasStoredStripeTruth,
    hasProviderSubscription,
    manualOverrideMasksProviderTruth,
    stateMatchesProviderTruth,
    hasIdentityMismatch: mismatchProfileIds.length > 0,
    replayEligibleEventCount: events.filter(isReplayEligibleStripeEvent).length,
    ignoredEventCount: ignoredEvents.length,
    missingProfileAttachEventCount,
    mismatchProfileIds,
    diagnostics,
    timeline,
    providerSubscription,
  };
}
