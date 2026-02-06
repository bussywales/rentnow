import type { UserRole } from "@/lib/types";

export function shouldShowClientPagesShortcut(role: UserRole | null | undefined): boolean {
  return role === "agent";
}
