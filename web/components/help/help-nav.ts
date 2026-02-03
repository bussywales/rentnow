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
    items: [{ label: "Support playbooks", href: "/help/admin/support-playbooks" }],
  },
];
