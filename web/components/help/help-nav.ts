export type HelpNavItem = {
  label: string;
  href: string;
};

export type HelpNavSection = {
  title: string;
  items: HelpNavItem[];
};

export const HELP_ADMIN_NAV: HelpNavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Admin Help Centre", href: "/help/admin" }],
  },
  {
    title: "Listings",
    items: [
      { label: "Listings hub", href: "/help/admin/listings" },
      { label: "Listings overview", href: "/help/admin/listings/overview" },
      { label: "Review workflow", href: "/help/admin/listings/review-workflow" },
      { label: "Statuses", href: "/help/admin/listings/statuses" },
      { label: "Featured", href: "/help/admin/listings/featured" },
    ],
  },
  {
    title: "Users",
    items: [{ label: "User management", href: "/help/admin/users" }],
  },
  {
    title: "Updates",
    items: [{ label: "Product updates", href: "/help/admin/product-updates" }],
  },
  {
    title: "Analytics",
    items: [{ label: "Performance", href: "/help/admin/analytics" }],
  },
  {
    title: "Support",
    items: [
      { label: "Support playbooks", href: "/help/admin/support-playbooks" },
      { label: "Intake & triage", href: "/help/admin/support-playbooks/intake-triage" },
      { label: "Login & access", href: "/help/admin/support-playbooks/login-access" },
      { label: "Listings", href: "/help/admin/support-playbooks/listings" },
      { label: "Messaging", href: "/help/admin/support-playbooks/messaging" },
      { label: "Sharing", href: "/help/admin/support-playbooks/sharing" },
      { label: "Verification", href: "/help/admin/support-playbooks/verification" },
      { label: "Legal & terms", href: "/help/admin/support-playbooks/legal" },
      { label: "Product updates", href: "/help/admin/support-playbooks/product-updates" },
      { label: "Analytics & events", href: "/help/admin/support-playbooks/analytics" },
      { label: "Featured scheduling", href: "/help/admin/support-playbooks/featured" },
    ],
  },
];
