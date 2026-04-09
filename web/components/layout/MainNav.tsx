import Image from "next/image";
import Link from "next/link";
import { NavAuthClient } from "@/components/layout/NavAuthClient";
import { NavLinksClient } from "@/components/layout/NavLinksClient";
import { NavMobileDrawerClient } from "@/components/layout/NavMobileDrawerClient";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { ProductUpdatesBell } from "@/components/updates/ProductUpdatesBell";
import { ProductUpdatesOnboarding } from "@/components/updates/ProductUpdatesOnboarding";
import { MarketSelector } from "@/components/layout/MarketSelector";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import type { UserRole } from "@/lib/types";
import type { BrandSocialLink } from "@/lib/brand-socials";

export const MAIN_NAV_LINKS: Array<{
  href: string;
  label: string;
  testId?: string;
  requireAuth?: boolean;
  requireRole?: UserRole | "super_admin";
  denyRoles?: UserRole[];
  badgeCount?: number | null;
}> = [
  { href: "/properties", label: "Properties" },
  { href: "/shortlets", label: "Shortlets" },
  { href: "/tenant/billing", label: "Billing", requireAuth: true, requireRole: "tenant" },
  { href: "/requests/new", label: "Make a Request", requireAuth: true, requireRole: "tenant" },
  { href: "/requests/my", label: "My Requests", requireAuth: true, requireRole: "tenant" },
  { href: "/tenant/saved", label: "Saved", requireAuth: true, requireRole: "tenant" },
  { href: "/trips", label: "Trips", requireAuth: true, requireRole: "tenant" },
  { href: "/dashboard/billing", label: "Billing", requireAuth: true, denyRoles: ["tenant", "admin"] },
  { href: "/host/calendar", label: "Calendar", requireAuth: true, denyRoles: ["tenant", "admin"] },
  { href: "/host/listings", label: "Listings", requireAuth: true, denyRoles: ["tenant", "admin"] },
  { href: "/favourites", label: "Collections", requireAuth: true, denyRoles: ["tenant"] },
  { href: "/tenant/home", label: "Home", requireAuth: true, requireRole: "tenant" },
  { href: "/saved-searches", label: "Saved searches", requireAuth: true, denyRoles: ["admin"] },
  { href: "/tenant", label: "Dashboard", requireAuth: true, requireRole: "tenant" },
  { href: "/home", label: "Home", requireAuth: true, denyRoles: ["tenant", "admin"] },
  {
    href: "/dashboard/analytics",
    label: "Dashboard",
    requireAuth: true,
    denyRoles: ["tenant", "admin"],
  },
  {
    href: "/host/bookings",
    label: "Bookings",
    requireAuth: true,
    denyRoles: ["tenant", "admin"],
  },
  {
    href: "/host/earnings",
    label: "Earnings",
    requireAuth: true,
    denyRoles: ["tenant", "admin"],
  },
  { href: "/admin", label: "Admin", requireAuth: true, requireRole: "admin" },
  { href: "/admin/help/tutorials", label: "Help Tutorials", requireAuth: true, requireRole: "admin" },
  {
    href: "/admin/analytics",
    label: "Analytics",
    testId: "nav-admin-analytics",
    requireAuth: true,
    requireRole: "admin",
  },
  { href: "/admin/product-updates", label: "Updates", requireAuth: true, requireRole: "admin" },
  { href: "/admin/support", label: "Support", requireAuth: true, requireRole: "admin" },
  { href: "/admin/legal", label: "Legal", requireAuth: true, requireRole: "admin" },
  { href: "/admin/settings", label: "Settings", requireAuth: true, requireRole: "admin" },
];

const DESKTOP_PRIMARY_LINKS = {
  guest: ["/shortlets", "/properties"],
  tenant: ["/shortlets", "/properties", "/trips", "/tenant/saved"],
  host: ["/host/bookings", "/host/calendar", "/host/listings", "/host/earnings"],
  admin: ["/admin"],
} as const;

export function resolveDesktopTopNavLinks(
  links: typeof MAIN_NAV_LINKS,
  {
    isAuthed,
    role,
  }: {
    isAuthed: boolean;
    role: UserRole | "super_admin" | null;
  }
) {
  const roleKey =
    !isAuthed || !role
      ? "guest"
      : role === "tenant"
        ? "tenant"
        : role === "admin" || role === "super_admin"
          ? "admin"
          : "host";
  const orderedHrefs = DESKTOP_PRIMARY_LINKS[roleKey];
  const byHref = new Map(links.map((link) => [link.href, link]));
  return orderedHrefs
    .map((href) => byHref.get(href))
    .filter((link): link is (typeof links)[number] => Boolean(link));
}

export function applyHostBookingsBadge(
  links: typeof MAIN_NAV_LINKS,
  awaitingApprovalCount: number
) {
  return links.map((link) => {
    if (link.href !== "/host/bookings") return link;
    return {
      ...link,
      badgeCount: awaitingApprovalCount > 0 ? awaitingApprovalCount : null,
    };
  });
}

export function MainNav({
  marketSelectorEnabled,
  initialAuthed = false,
  initialRole = null,
  initialAccountName = null,
  initialAccountAvatarUrl = null,
  socialLinks = [],
  hostAwaitingApprovalCount = 0,
}: {
  marketSelectorEnabled: boolean;
  initialAuthed?: boolean;
  initialRole?: UserRole | "super_admin" | null;
  initialAccountName?: string | null;
  initialAccountAvatarUrl?: string | null;
  socialLinks?: BrandSocialLink[];
  hostAwaitingApprovalCount?: number;
}) {
  const role = initialRole;
  const navLinks = applyHostBookingsBadge(MAIN_NAV_LINKS, hostAwaitingApprovalCount);
  const desktopLinks = resolveDesktopTopNavLinks(navLinks, {
    isAuthed: initialAuthed,
    role,
  });
  const accountLabel = initialAccountName?.trim() || "Account";
  const accountInitials = accountLabel
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "AC";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur-lg shadow-[0_1px_10px_rgba(15,23,42,0.06)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16">
        <div className="flex items-center">
          <BrandLogo variant="minimal" size="sm" className="sm:hidden" />
          <BrandLogo variant="header" size="md" className="hidden sm:inline-flex" />
        </div>

        <nav className="hidden items-center gap-6 text-sm text-slate-700 md:flex">
          <NavLinksClient links={desktopLinks} initialAuthed={initialAuthed} initialRole={role} />
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <MarketSelector enabled={marketSelectorEnabled} />
          </div>
          <NotificationsBell initialAuthed={initialAuthed} initialRole={role} />
          <ProductUpdatesBell initialAuthed={initialAuthed} />
          {initialAuthed ? (
            <Link
              href="/profile"
              aria-label="Open profile"
              title={accountLabel}
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200/90 bg-white text-sm font-semibold text-slate-700 shadow-[0_2px_12px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 md:inline-flex"
            >
              <span className="sr-only">Profile</span>
              {initialAccountAvatarUrl ? (
                <span className="relative block h-9 w-9 overflow-hidden rounded-full">
                  <Image
                    src={initialAccountAvatarUrl}
                    alt=""
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.32),rgba(226,232,240,0.95)_72%)] text-[11px] uppercase tracking-[0.16em] text-slate-700"
                >
                  {accountInitials}
                </span>
              )}
            </Link>
          ) : null}
          <NavAuthClient initialAuthed={initialAuthed} />
          <NavMobileDrawerClient
            links={navLinks}
            initialAuthed={initialAuthed}
            initialRole={role}
            marketSelectorEnabled={marketSelectorEnabled}
            socialLinks={socialLinks}
          />
        </div>
      </div>
      <ProductUpdatesOnboarding initialAuthed={initialAuthed} />
    </header>
  );
}
