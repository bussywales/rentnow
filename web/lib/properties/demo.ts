import type { UserRole } from "@/lib/types";

export const DEMO_LISTINGS_VISIBILITY_POLICIES = ["restricted", "public"] as const;
export type DemoListingsVisibilityPolicy =
  (typeof DEMO_LISTINGS_VISIBILITY_POLICIES)[number];

const DEMO_HOST_ROLES = new Set<UserRole>(["landlord", "agent"]);

type DemoVisibilityInput = {
  viewerRole?: UserRole | null;
  viewerId?: string | null;
  ownerId?: string | null;
  policy?: DemoListingsVisibilityPolicy | string | null;
};

type DemoRenderInput = {
  isDemo?: boolean | null;
  enabled?: boolean;
};

export function includeDemoListingsForViewer({
  viewerRole,
  viewerId,
  ownerId,
  policy = "restricted",
}: DemoVisibilityInput): boolean {
  const normalizedPolicy = normalizeDemoListingsVisibilityPolicy(policy);
  if (normalizedPolicy === "public") return true;
  if (viewerRole === "admin") return true;
  if (viewerRole && DEMO_HOST_ROLES.has(viewerRole)) return true;
  if (viewerId && ownerId && viewerId === ownerId) return true;
  return false;
}

export function shouldFilterOutDemoListings(input: DemoVisibilityInput): boolean {
  return !includeDemoListingsForViewer(input);
}

export function normalizeDemoListingsVisibilityPolicy(
  value: unknown,
  fallback: DemoListingsVisibilityPolicy = "restricted"
): DemoListingsVisibilityPolicy {
  if (typeof value !== "string") return fallback;
  return value.trim().toLowerCase() === "public" ? "public" : "restricted";
}

export function shouldRenderDemoBadge({
  isDemo,
  enabled = true,
}: DemoRenderInput): boolean {
  return !!isDemo && enabled;
}

export function shouldRenderDemoWatermark({
  isDemo,
  enabled = false,
}: DemoRenderInput): boolean {
  return !!isDemo && enabled;
}
