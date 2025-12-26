export type PlanGate = {
  name: string;
  maxListings: number;
  featuredListing: boolean;
  instantApproval: boolean;
};

const LANDLORD_PLAN: PlanGate = {
  name: "Starter",
  maxListings: 3,
  featuredListing: false,
  instantApproval: false,
};

const AGENT_PLAN: PlanGate = {
  name: "Agency",
  maxListings: 10,
  featuredListing: true,
  instantApproval: false,
};

export function getPlanForRole(role?: string | null): PlanGate | null {
  if (role === "landlord") return LANDLORD_PLAN;
  if (role === "agent") return AGENT_PLAN;
  return null;
}

export function isListingLimitReached(count: number, plan: PlanGate | null) {
  if (!plan) return false;
  return count >= plan.maxListings;
}

