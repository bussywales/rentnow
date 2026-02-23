import { normalizeRole } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export type WorkspaceRole = UserRole | "super_admin" | string | null | undefined;

export type WorkspaceSidebarItem = {
  key: string;
  label: string;
  href: string;
  badgeCount?: number | null;
};

export type WorkspaceSidebarSection = {
  key: "core" | "agent-tools" | "legacy-tools" | "admin";
  label: "Core" | "Agent tools" | "Legacy tools" | "Admin";
  items: WorkspaceSidebarItem[];
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

export function getWorkspaceSidebarSections(
  input: WorkspaceSidebarInput
): WorkspaceSidebarSection[] {
  const role = normalizeWorkspaceRole(input.role);
  const awaitingApprovalCount = asBadgeCount(input.awaitingApprovalCount);
  const unreadMessages = asBadgeCount(input.unreadMessages);
  const showAgentNetwork = input.showAgentNetwork !== false;

  if (!role || role === "tenant") return [];

  if (role === "admin") {
    return [
      {
        key: "admin",
        label: "Admin",
        items: [{ key: "admin", label: "Admin", href: "/admin" }],
      },
    ];
  }

  const coreItems: WorkspaceSidebarItem[] = [
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

  if (role === "landlord") {
    return [{ key: "core", label: "Core", items: coreItems }];
  }

  const agentToolsItems: WorkspaceSidebarItem[] = [
    { key: "clients", label: "Client pages", href: "/profile/clients" },
    { key: "leads", label: "Leads", href: "/host/leads" },
    {
      key: "messages",
      label: "Messages",
      href: "/dashboard/messages",
      badgeCount: unreadMessages,
    },
    { key: "referrals", label: "Referrals", href: "/dashboard/referrals" },
  ];

  if (showAgentNetwork) {
    agentToolsItems.push({
      key: "agent-network",
      label: "Agent Network",
      href: "/dashboard/agent-network",
    });
  }

  const legacyToolsItems: WorkspaceSidebarItem[] = [
    { key: "analytics", label: "Analytics", href: "/dashboard/analytics" },
    { key: "billing", label: "Billing", href: "/dashboard/billing" },
    { key: "viewings", label: "Viewings", href: "/dashboard/viewings" },
    { key: "saved-searches", label: "Saved searches", href: "/dashboard/saved-searches" },
    { key: "collaborations", label: "Collaborations", href: "/dashboard/collaborations" },
    { key: "verification", label: "Verification", href: "/dashboard/settings/verification" },
  ];

  return [
    { key: "core", label: "Core", items: coreItems },
    { key: "agent-tools", label: "Agent tools", items: agentToolsItems },
    { key: "legacy-tools", label: "Legacy tools", items: legacyToolsItems },
  ];
}

export function getWorkspaceSidebarItems(input: WorkspaceSidebarInput): WorkspaceSidebarItem[] {
  return getWorkspaceSidebarSections(input).flatMap((section) => section.items);
}
