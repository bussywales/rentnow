import type { WorkspaceRole } from "@/lib/workspace/sidebar-model";
import { normalizeWorkspaceRole } from "@/lib/workspace/sidebar-model";

export const WORKSPACE_LEGACY_BANNER_HIDDEN_KEY = "workspace:legacyBanner:hidden:v1";

export function readLegacyBannerHidden() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WORKSPACE_LEGACY_BANNER_HIDDEN_KEY) === "1";
}

export function writeLegacyBannerHidden(next: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORKSPACE_LEGACY_BANNER_HIDDEN_KEY, next ? "1" : "0");
}

export function shouldShowLegacyToolsBanner(input: {
  role: WorkspaceRole;
  pathname: string;
  hidden: boolean;
}) {
  if (input.hidden) return false;
  const role = normalizeWorkspaceRole(input.role);
  const isAllowedRole = role === "agent" || role === "admin";
  if (!isAllowedRole) return false;
  return input.pathname.startsWith("/dashboard");
}
