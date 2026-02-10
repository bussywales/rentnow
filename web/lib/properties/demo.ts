import type { UserRole } from "@/lib/types";

type DemoVisibilityInput = {
  viewerRole?: UserRole | null;
  nodeEnv?: string;
};

type DemoRenderInput = {
  isDemo?: boolean | null;
  enabled?: boolean;
};

export function includeDemoListingsForViewer({
  viewerRole,
  nodeEnv = process.env.NODE_ENV ?? "development",
}: DemoVisibilityInput): boolean {
  if (viewerRole === "admin") return true;
  return nodeEnv !== "production";
}

export function shouldFilterOutDemoListings(input: DemoVisibilityInput): boolean {
  return !includeDemoListingsForViewer(input);
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
