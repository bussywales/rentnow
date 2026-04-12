import { normalizeRole, type KnownRole } from "@/lib/roles";

export type SupportWidgetQuickAction = {
  id: string;
  label: string;
  href: string;
};

type BuildSupportWidgetQuickActionsInput = {
  pathname?: string | null;
  role?: string | null;
};

function getAudience(pathname?: string | null, role?: string | null): KnownRole | "host" | "public" {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole && normalizedRole !== "admin") return normalizedRole;
  if (pathname?.startsWith("/host")) return "host";
  return "public";
}

function buildTenantActions(isShortletsRoute: boolean): SupportWidgetQuickAction[] {
  if (isShortletsRoute) {
    return [
      { id: "bookings-stays", label: "Bookings and stays", href: "/help/tenant/shortlets-trips" },
      {
        id: "checkin-rules",
        label: "Check-in and house rules",
        href: "/help/tenant/shortlets-checkin-and-rules",
      },
      {
        id: "booking-timeline",
        label: "Booking timing and payments",
        href: "/help/tenant/shortlets-trips-timeline",
      },
      {
        id: "account-access",
        label: "Account and access",
        href: "/help/troubleshooting/getting-started",
      },
    ];
  }

  return [
    { id: "search-alerts", label: "Search and alerts", href: "/help/tenant/alerts-and-notifications" },
    { id: "requests-enquiries", label: "Requests and enquiries", href: "/help/tenant/property-requests" },
    { id: "bookings-stays", label: "Bookings and stays", href: "/help/tenant/shortlets-trips" },
    {
      id: "account-access",
      label: "Account and access",
      href: "/help/troubleshooting/getting-started",
    },
  ];
}

function buildLandlordActions(isServicesRoute: boolean): SupportWidgetQuickAction[] {
  const actions: SupportWidgetQuickAction[] = [
    { id: "listings-publishing", label: "Listings and publishing", href: "/help/landlord/core-workflows" },
    { id: "billing-plans", label: "Billing and plans", href: "/help/landlord/listing-monetisation" },
    { id: "qr-sign-kit", label: "QR and sign kit", href: "/help/landlord/qr-sign-kit" },
    { id: "requests-enquiries", label: "Requests and enquiries", href: "/help/landlord/property-requests" },
  ];

  if (isServicesRoute) {
    actions[0] = { id: "move-ready-services", label: "Move & Ready services", href: "/help/host/services" };
  }

  return actions;
}

function buildAgentActions(isServicesRoute: boolean): SupportWidgetQuickAction[] {
  const actions: SupportWidgetQuickAction[] = [
    { id: "listings-publishing", label: "Listings and publishing", href: "/help/agent/core-workflows" },
    { id: "billing-plans", label: "Billing and plans", href: "/help/agent/listing-monetisation" },
    { id: "qr-sign-kit", label: "QR and sign kit", href: "/help/agent/qr-sign-kit" },
    { id: "referrals", label: "Referrals", href: "/help/agent/referrals" },
  ];

  if (isServicesRoute) {
    actions[0] = { id: "move-ready-services", label: "Move & Ready services", href: "/help/agent/services" };
  }

  return actions;
}

function buildUniversalSupportActions(): SupportWidgetQuickAction[] {
  return [
    { id: "report-issue", label: "Report an issue", href: "/support" },
    { id: "contact-support", label: "Contact support", href: "/support" },
  ];
}

export function buildSupportWidgetQuickActions({
  pathname = null,
  role = null,
}: BuildSupportWidgetQuickActionsInput): SupportWidgetQuickAction[] {
  const isShortletsRoute = pathname?.startsWith("/shortlets") ?? false;
  const isServicesRoute = pathname?.startsWith("/host/services") ?? false;
  const audience = getAudience(pathname, role);

  const primaryActions =
    audience === "agent"
      ? buildAgentActions(isServicesRoute)
      : audience === "landlord" || audience === "host"
        ? buildLandlordActions(isServicesRoute)
        : buildTenantActions(isShortletsRoute);

  return [...primaryActions, ...buildUniversalSupportActions()];
}
