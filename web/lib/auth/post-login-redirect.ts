import type { UserRole } from "@/lib/types";

export type PostLoginRedirectInput = {
  role?: UserRole | null;
  nextPath?: string | null;
};

export function normalizePostLoginPath(
  value?: string | null,
  fallback = "/dashboard"
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  return trimmed;
}

export function resolvePostLoginRedirect({
  role,
  nextPath,
}: PostLoginRedirectInput): string {
  const normalizedNext = normalizePostLoginPath(nextPath, "");
  if (normalizedNext) {
    return normalizedNext;
  }

  if (role === "tenant") {
    return "/tenant/home";
  }

  if (role === "admin") {
    return "/admin";
  }

  if (role === "agent" || role === "landlord") {
    return "/home";
  }

  return "/dashboard";
}
