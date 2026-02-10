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
    items: [
      { label: "Product updates", href: "/help/admin/product-updates" },
      { label: "Help publishing guide", href: "/help/admin/help-publishing" },
    ],
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
      { label: "Email delivery & limits", href: "/help/admin/support-playbooks/email-delivery" },
      { label: "Resend SMTP setup", href: "/help/admin/support-playbooks/resend-smtp" },
      { label: "Legal & terms", href: "/help/admin/support-playbooks/legal" },
      { label: "Product updates", href: "/help/admin/support-playbooks/product-updates" },
      { label: "Analytics & events", href: "/help/admin/support-playbooks/analytics" },
      { label: "Featured scheduling", href: "/help/admin/support-playbooks/featured" },
    ],
  },
];

export const HELP_AGENT_NAV: HelpNavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Agent Help Centre", href: "/help/agents#overview" },
      { label: "Start here", href: "/help/agents#start-here" },
      { label: "Most common tasks", href: "/help/agents#common-tasks" },
    ],
  },
  {
    title: "Referrals",
    items: [
      { label: "Referrals overview", href: "/help/agents#referrals" },
      { label: "Referral FAQ", href: "/help/referrals#for-agents-hosts" },
      {
        label: "Share referral link",
        href: "/help/agents/articles/how-to-share-your-referral-link",
      },
      {
        label: "Active referrals explained",
        href: "/help/agents/articles/understanding-active-referrals",
      },
    ],
  },
  {
    title: "Listings & leads",
    items: [
      { label: "Listings & publishing", href: "/help/agents#listings-publishing" },
      { label: "Viewings & leads", href: "/help/agents#viewings-leads" },
      {
        label: "Publish a listing",
        href: "/help/agents/articles/how-to-publish-a-listing",
      },
    ],
  },
  {
    title: "Discovery",
    items: [
      { label: "Saved searches & alerts", href: "/help/agents#saved-searches-alerts" },
      {
        label: "Saved searches guide",
        href: "/help/agents/articles/saved-searches-and-alerts",
      },
    ],
  },
  {
    title: "Billing & trust",
    items: [
      { label: "Credits & billing", href: "/help/agents#credits-billing" },
      { label: "Safety & reporting", href: "/help/agents#safety-reporting" },
      { label: "Troubleshooting", href: "/help/agents#troubleshooting" },
      { label: "Browse all articles", href: "/help/articles" },
    ],
  },
];
