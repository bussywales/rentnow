import { safeTrim } from "@/lib/agents/agent-storefront";

export type StorefrontCredibilityMetrics = {
  memberSince: string | null;
  liveListingsCount: number | null;
  enquiriesCount: number | null;
  activeThisWeek: boolean;
};

export function buildStorefrontCredibilityChips(
  metrics: StorefrontCredibilityMetrics
): string[] {
  const chips: string[] = [];

  const memberSince = safeTrim(metrics.memberSince);
  if (memberSince) {
    const year = new Date(memberSince).getFullYear();
    if (!Number.isNaN(year)) {
      chips.push(`Member since ${year}`);
    }
  }

  if (typeof metrics.liveListingsCount === "number" && metrics.liveListingsCount > 0) {
    chips.push(
      metrics.liveListingsCount === 1
        ? "1 live listing"
        : `${metrics.liveListingsCount} live listings`
    );
  }

  if (typeof metrics.enquiriesCount === "number" && metrics.enquiriesCount > 0) {
    chips.push(
      metrics.enquiriesCount === 1
        ? "1 enquiry received"
        : `${metrics.enquiriesCount} enquiries received`
    );
  }

  if (metrics.activeThisWeek) {
    chips.push("Active this week");
  }

  return chips;
}
