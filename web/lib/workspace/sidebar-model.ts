import { normalizeRole } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export type WorkspaceRole = UserRole | "super_admin" | string | null | undefined;

export type WorkspaceSidebarItem = {
  key: string;
  label: string;
  href: string;
  badgeCount?: number | null;
};

type WorkspaceSidebarInput = {
  role: WorkspaceRole;
  awaitingApprovalCount?: number | null;
  unreadMessages?: number | null;
  showAgentNetwork?: boolean;
};

export function normalizeWorkspaceRole(role: WorkspaceRole): UserRole | "admin" | null {
  if (role === "super_admin") return "admin";
  return normalizeRole(role) ?? null;
}

function asBadgeCount(value: number | null | undefined) {
  return value && value > 0 ? value : null;
}

export function getWorkspaceSidebarItems(input: WorkspaceSidebarInput): WorkspaceSidebarItem[] {
  const role = normalizeWorkspaceRole(input.role);
  const awaitingApprovalCount = asBadgeCount(input.awaitingApprovalCount);
  const unreadMessages = asBadgeCount(input.unreadMessages);
  const showAgentNetwork = input.showAgentNetwork !== false;

  if (!role || role === "tenant") return [];

  if (role === "admin") {
    return [{ key: "admin", label: "Admin", href: "/admin" }];
  }

  const landlordItems: WorkspaceSidebarItem[] = [
    { key: "overview", label: "Overview", href: "/host" },
    { key: "listings", label: "Listings", href: "/host/listings" },
    {
      key: "bookings",
      label: "Bookings",
      href: "/host/bookings",
      badgeCount: awaitingApprovalCount,
    },
    { key: "calendar", label: "Calendar", href: "/host/calendar" },
    { key: "earnings", label: "Earnings", href: "/host/earnings" },
  ];

  if (role === "landlord") return landlordItems;

  const agentItems: WorkspaceSidebarItem[] = [
    { key: "clients", label: "Client pages", href: "/profile/clients" },
    { key: "leads", label: "Leads", href: "/dashboard/leads" },
    { key: "referrals", label: "Referrals", href: "/dashboard/referrals" },
    {
      key: "messages",
      label: "Messages",
      href: "/dashboard/messages",
      badgeCount: unreadMessages,
    },
  ];

  if (showAgentNetwork) {
    agentItems.push({
      key: "agent-network",
      label: "Agent Network",
      href: "/dashboard/agent-network",
    });
  }

  return [...landlordItems, ...agentItems];
}
