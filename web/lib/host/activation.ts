import type { SubscriptionLifecycleState } from "@/lib/billing/subscription-lifecycle";
import type { PlanGate } from "@/lib/plans";

export type HostActivationInput = {
  role: "landlord" | "agent";
  billingSource: string | null;
  lifecycle: SubscriptionLifecycleState;
  plan: PlanGate | null;
  activeListings: number;
  draftListings: number;
  pendingListings: number;
  liveListings: number;
  rejectedListings: number;
  changesRequestedListings: number;
  hasFeaturedRequest: boolean;
  hasFeaturedListing: boolean;
  profileMissingFields: string[];
};

export type HostActivationStep = {
  label: string;
  href: string;
  description: string;
};

export type HostActivationMetricTone = "neutral" | "positive" | "warning" | "danger";

export type HostActivationMetric = {
  key: string;
  label: string;
  count: number;
  tone: HostActivationMetricTone;
};

export type HostActivationState = {
  planLabel: string;
  billingSourceLabel: string;
  lifecycleLabel: string;
  lifecycleDescription: string;
  usageSummary: string;
  unlocked: string[];
  nextStep: HostActivationStep;
  blockers: string[];
  metrics: HostActivationMetric[];
};

type HostProfileInput = {
  phone?: string | null;
  preferredContact?: string | null;
};

function capitalize(value: string) {
  if (!value) return "";
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatHostPlanLabel(role: HostActivationInput["role"], plan: PlanGate | null) {
  if (!plan) return "Free";
  if (plan.tier === "pro") {
    return role === "agent" ? "Agent Pro" : "Landlord Pro";
  }
  if (plan.tier === "starter") {
    return role === "agent" ? "Agent Starter" : "Landlord Starter";
  }
  return plan.name;
}

export function listMissingHostProfileFields(input: HostProfileInput) {
  const missing: string[] = [];
  if (!String(input.phone || "").trim()) missing.push("phone number");
  if (!String(input.preferredContact || "").trim()) missing.push("preferred contact");
  return missing;
}

function buildNextStep(input: HostActivationInput): HostActivationStep {
  if (input.profileMissingFields.length > 0) {
    return {
      label: "Complete profile",
      href: `/onboarding/${input.role}`,
      description: `Add ${input.profileMissingFields.join(" and ")} so tenants can reach you and listings move through approval faster.`,
    };
  }

  if (input.rejectedListings > 0 || input.changesRequestedListings > 0) {
    return {
      label: "Update listing and resubmit",
      href: "/dashboard/properties",
      description: "One or more listings need edits before they can go live again. Fix the flagged issues and resubmit for review.",
    };
  }

  if (input.draftListings > 0) {
    return {
      label: "Finish your draft listing",
      href: "/dashboard/properties",
      description: "Complete the key listing details, then submit the draft for approval so it can start moving toward live inventory.",
    };
  }

  if (input.pendingListings > 0) {
    return {
      label: "Track approval status",
      href: "/dashboard/properties",
      description: "Your listing is already in review. Check its status and be ready to respond if approval feedback comes back.",
    };
  }

  if (input.liveListings === 0) {
    return {
      label: "Create your first listing",
      href: "/dashboard/properties/new",
      description: "Your plan is ready, but value starts when a listing is submitted and approved. Create the first one now.",
    };
  }

  return {
    label: "Manage live listings",
    href: "/dashboard/properties",
    description: "Keep pricing, photos, and response times sharp so your live inventory continues to convert.",
  };
}

function buildBlockers(input: HostActivationInput) {
  const blockers: string[] = [];

  if (input.profileMissingFields.length > 0) {
    blockers.push(`Profile still needs ${input.profileMissingFields.join(" and ")}.`);
  }

  if (input.rejectedListings > 0) {
    blockers.push(
      `${pluralize(input.rejectedListings, "listing")} ${input.rejectedListings === 1 ? "was" : "were"} rejected and must be updated before going live.`
    );
  }

  if (input.changesRequestedListings > 0) {
    blockers.push(
      `${pluralize(input.changesRequestedListings, "listing")} ${input.changesRequestedListings === 1 ? "has" : "have"} changes requested and need edits before resubmission.`
    );
  }

  if (input.lifecycle.key === "payment_issue") {
    blockers.push("Stripe still owns billing, but renewal is at risk until the payment issue is resolved.");
  }

  if (input.lifecycle.key === "manual_override") {
    blockers.push("Billing is currently controlled manually, so provider-owned renewal actions are not in effect.");
  }

  return blockers;
}

function buildUnlocked(plan: PlanGate | null) {
  if (!plan) {
    return ["Publish up to 1 active listing on the free baseline.", "Featured placement stays locked until Pro."];
  }

  const unlocked = [`Publish up to ${plan.maxListings} active ${plan.maxListings === 1 ? "listing" : "listings"}.`];

  if (plan.featuredListing) {
    unlocked.push("Featured placement requests are available once a listing is ready.");
  } else {
    unlocked.push("Featured placement stays locked until Pro.");
  }

  return unlocked;
}

function buildMetrics(input: HostActivationInput): HostActivationMetric[] {
  const metrics: HostActivationMetric[] = [];

  const definitions: Array<{
    key: string;
    label: string;
    count: number;
    tone: HostActivationMetricTone;
  }> = [
    { key: "live", label: "Live", count: input.liveListings, tone: "positive" },
    { key: "pending", label: "Awaiting review", count: input.pendingListings, tone: "warning" },
    { key: "draft", label: "Draft", count: input.draftListings, tone: "neutral" },
    { key: "changes_requested", label: "Changes requested", count: input.changesRequestedListings, tone: "warning" },
    { key: "rejected", label: "Rejected", count: input.rejectedListings, tone: "danger" },
  ];

  for (const definition of definitions) {
    if (definition.count > 0) metrics.push(definition);
  }

  if (metrics.length === 0) {
    metrics.push({ key: "none", label: "No listings yet", count: 0, tone: "neutral" });
  }

  return metrics;
}

export function buildHostActivationState(input: HostActivationInput): HostActivationState {
  const planLabel = formatHostPlanLabel(input.role, input.plan);
  const maxListings = input.plan?.maxListings ?? 1;
  const usageSummary = `${input.activeListings}/${maxListings} active ${maxListings === 1 ? "listing slot" : "listing slots"} in use`;

  return {
    planLabel,
    billingSourceLabel: capitalize(input.billingSource ?? "manual"),
    lifecycleLabel: input.lifecycle.label,
    lifecycleDescription: input.lifecycle.description,
    usageSummary,
    unlocked: buildUnlocked(input.plan),
    nextStep: buildNextStep(input),
    blockers: buildBlockers(input),
    metrics: buildMetrics(input),
  };
}
