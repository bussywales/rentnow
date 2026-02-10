export type DashboardNavItem = {
  key: string;
  label: string;
  href: string;
  show: boolean;
  showUnread?: boolean;
};

export function getAgentDashboardNavItems(input: {
  showMyProperties: boolean;
  showSavedSearches: boolean;
  showAgentNetwork: boolean;
}): DashboardNavItem[] {
  const { showMyProperties, showSavedSearches, showAgentNetwork } = input;
  return [
    { key: "listings", label: "My listings", href: "/host", show: showMyProperties },
    { key: "client-pages", label: "Client pages", href: "/profile/clients", show: true },
    { key: "leads", label: "Leads", href: "/dashboard/leads", show: showMyProperties },
    { key: "referrals", label: "Referrals", href: "/dashboard/referrals", show: true },
    {
      key: "agent-network",
      label: "Agent Network",
      href: "/dashboard/agent-network",
      show: showAgentNetwork,
    },
    { key: "messages", label: "Messages", href: "/dashboard/messages", show: true, showUnread: true },
    { key: "viewings", label: "Viewings", href: "/dashboard/viewings", show: true },
    { key: "analytics", label: "Analytics", href: "/dashboard/analytics", show: showMyProperties },
    { key: "billing", label: "Billing", href: "/dashboard/billing", show: true },
    {
      key: "saved-searches",
      label: "Saved searches",
      href: "/dashboard/saved-searches",
      show: showSavedSearches,
    },
    {
      key: "verification",
      label: "Verification",
      href: "/dashboard/settings/verification",
      show: true,
    },
  ];
}
