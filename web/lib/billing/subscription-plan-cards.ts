import type { PlanTier } from "@/lib/plans";

export type BillingPlanRole = "landlord" | "agent" | "tenant";

export type SubscriptionPlanCardConfig = {
  key: string;
  title: string;
  tier: PlanTier;
  role?: BillingPlanRole;
  highlight?: boolean;
  features: string[];
  usageType?: "listings" | "saved_searches";
};

export const SUBSCRIPTION_PLAN_CARDS: SubscriptionPlanCardConfig[] = [
  {
    key: "free",
    title: "Free",
    tier: "free",
    features: ["Essentials to browse or list", "Standard approval queue", "Email support"],
  },
  {
    key: "landlord-pro",
    title: "Landlord Pro",
    tier: "pro",
    role: "landlord",
    highlight: true,
    features: ["Publish up to 10 active listings", "Featured placement on search", "Priority approval queue"],
  },
  {
    key: "agent-pro",
    title: "Agent Pro",
    tier: "pro",
    role: "agent",
    features: ["Publish up to 10 active listings", "Manage multiple landlords", "Priority approval queue"],
  },
  {
    key: "tenant-pro",
    title: "Tenant Pro",
    tier: "tenant_pro",
    role: "tenant",
    usageType: "saved_searches",
    features: ["Unlimited saved searches", "Instant alerts for new listings", "Priority contact on listings"],
  },
];

export function getSubscriptionPlanCardKeyForRole(role: string | null | undefined): string | null {
  if (role === "tenant") return "tenant-pro";
  if (role === "agent") return "agent-pro";
  if (role === "landlord") return "landlord-pro";
  return null;
}
