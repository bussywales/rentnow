import Link from "next/link";
import { NavAuthClient } from "@/components/layout/NavAuthClient";
import { NavLinksClient } from "@/components/layout/NavLinksClient";
import { NavMobileDrawerClient } from "@/components/layout/NavMobileDrawerClient";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { ProductUpdatesOnboarding } from "@/components/updates/ProductUpdatesOnboarding";
import { MarketSelector } from "@/components/layout/MarketSelector";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import { normalizeRole } from "@/lib/roles";
import { countAwaitingApprovalBookings } from "@/lib/shortlet/host-bookings-inbox";
import { getEnabledBrandSocialLinks } from "@/lib/brand-socials";

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
  { href: "/tenant/saved", label: "Saved", requireAuth: true, requireRole: "tenant" },
  { href: "/trips", label: "Trips", requireAuth: true, requireRole: "tenant" },
  { href: "/host/calendar", label: "Calendar", requireAuth: true, denyRoles: ["tenant", "admin"] },
  { href: "/host/properties", label: "Listings", requireAuth: true, denyRoles: ["tenant", "admin"] },
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
  {
    href: "/admin/insights",
    label: "Insights",
    testId: "nav-admin-insights",
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
  host: ["/host/bookings", "/host/calendar", "/host/properties", "/host/earnings"],
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

export async function MainNav({
  marketSelectorEnabled,
}: {
  marketSelectorEnabled: boolean;
}) {
  let initialAuthed = false;
  let role: UserRole | "super_admin" | null = null;
  let hostAwaitingApprovalCount = 0;

  if (hasServerSupabaseEnv()) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (!error) {
        initialAuthed = !!user;
        const userId = user?.id;
        if (userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .maybeSingle();
          role = normalizeRole(profile?.role) as UserRole | "super_admin" | null;

          if (role === "landlord" || role === "agent") {
            const { data: shortletProperties } = await supabase
              .from("properties")
              .select("id")
              .eq("owner_id", userId)
              .eq("listing_intent", "shortlet")
              .limit(600);

            const propertyIds = (shortletProperties ?? [])
              .map((row) => String(row.id || ""))
              .filter(Boolean);

            if (propertyIds.length) {
              const bookingsWithRespondBy = await supabase
                .from("shortlet_bookings")
                .select("id,status,respond_by,expires_at")
                .eq("status", "pending")
                .in("property_id", propertyIds)
                .order("created_at", { ascending: false })
                .limit(800);

              let bookingsError = bookingsWithRespondBy.error;
              let bookingsRows: Array<Record<string, unknown>> =
                (bookingsWithRespondBy.data as Array<Record<string, unknown>> | null) ?? [];

              if (bookingsError?.message?.toLowerCase().includes("respond_by")) {
                const bookingsWithoutRespondBy = await supabase
                  .from("shortlet_bookings")
                  .select("id,status,expires_at")
                  .eq("status", "pending")
                  .in("property_id", propertyIds)
                  .order("created_at", { ascending: false })
                  .limit(800);
                bookingsError = bookingsWithoutRespondBy.error;
                bookingsRows =
                  (bookingsWithoutRespondBy.data as Array<Record<string, unknown>> | null) ?? [];
              }

              if (!bookingsError) {
                hostAwaitingApprovalCount = countAwaitingApprovalBookings(
                  bookingsRows.map((row) => ({
                    id: String(row.id || ""),
                    status: String(row.status || ""),
                    respond_by: typeof row.respond_by === "string" ? row.respond_by : null,
                    expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
                  }))
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("Unable to resolve initial auth state", err);
    }
  }

  const navLinks = applyHostBookingsBadge(MAIN_NAV_LINKS, hostAwaitingApprovalCount);
  const desktopLinks = resolveDesktopTopNavLinks(navLinks, {
    isAuthed: initialAuthed,
    role,
  });
  const socialLinks = await getEnabledBrandSocialLinks();

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
          {initialAuthed ? (
            <Link
              href="/profile"
              className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 md:inline-flex"
            >
              Profile
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
