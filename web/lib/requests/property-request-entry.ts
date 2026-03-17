import type { UserRole } from "@/lib/types";

export type PropertyRequestQuickStartEntry = {
  label: "Make a Request";
  href: string;
};

const REQUEST_CREATE_PATH = "/requests/new";

export function getPropertyRequestQuickStartEntry(
  role: UserRole | null
): PropertyRequestQuickStartEntry | null {
  if (role === "tenant") {
    return {
      label: "Make a Request",
      href: REQUEST_CREATE_PATH,
    };
  }

  if (role !== null) {
    return null;
  }

  return {
    label: "Make a Request",
    href: `/auth/login?reason=auth&redirect=${encodeURIComponent(REQUEST_CREATE_PATH)}`,
  };
}
