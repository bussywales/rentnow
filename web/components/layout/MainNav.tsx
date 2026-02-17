import { NavAuthClient } from "@/components/layout/NavAuthClient";
import { NavLinksClient } from "@/components/layout/NavLinksClient";
import { NavMobileDrawerClient } from "@/components/layout/NavMobileDrawerClient";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { HelpDrawer } from "@/components/help/HelpDrawer";
import { ProductUpdatesBell } from "@/components/updates/ProductUpdatesBell";
import { ProductUpdatesOnboarding } from "@/components/updates/ProductUpdatesOnboarding";
import { MarketSelector } from "@/components/layout/MarketSelector";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import { normalizeRole } from "@/lib/roles";
import { getHelpDocsForRole } from "@/lib/help/docs";

export const MAIN_NAV_LINKS: Array<{
  href: string;
  label: string;
  testId?: string;
  requireAuth?: boolean;
  requireRole?: UserRole | "super_admin";
  denyRoles?: UserRole[];
}> = [
  { href: "/properties", label: "Browse" },
  { href: "/tenant/saved", label: "Collections", requireAuth: true, requireRole: "tenant" },
  { href: "/trips", label: "Trips", requireAuth: true, requireRole: "tenant" },
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

export async function MainNav({
  marketSelectorEnabled,
}: {
  marketSelectorEnabled: boolean;
}) {
  let initialAuthed = false;
  let role: UserRole | "super_admin" | null = null;

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
        }
      }
    } catch (err) {
      console.warn("Unable to resolve initial auth state", err);
    }
  }

  const [tenantDocs, landlordDocs, agentDocs, adminDocs] = await Promise.all([
    getHelpDocsForRole("tenant"),
    getHelpDocsForRole("landlord"),
    getHelpDocsForRole("agent"),
    getHelpDocsForRole("admin"),
  ]);

  const helpDocsByRole = {
    tenant: tenantDocs.map((doc) => ({
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      updatedAt: doc.updatedAt,
      body: doc.body,
    })),
    landlord: landlordDocs.map((doc) => ({
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      updatedAt: doc.updatedAt,
      body: doc.body,
    })),
    agent: agentDocs.map((doc) => ({
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      updatedAt: doc.updatedAt,
      body: doc.body,
    })),
    admin: adminDocs.map((doc) => ({
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      updatedAt: doc.updatedAt,
      body: doc.body,
    })),
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur-lg shadow-[0_1px_10px_rgba(15,23,42,0.06)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16">
        <div className="flex items-center">
          <BrandLogo variant="minimal" size="sm" className="sm:hidden" />
          <BrandLogo variant="header" size="md" className="hidden sm:inline-flex" />
        </div>

        <nav className="hidden items-center gap-6 text-sm text-slate-700 md:flex">
          <NavLinksClient
            links={MAIN_NAV_LINKS.filter((link) => link.href !== "/admin/insights")}
            initialAuthed={initialAuthed}
            initialRole={role}
          />
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <MarketSelector enabled={marketSelectorEnabled} />
          </div>
          <HelpDrawer initialAuthed={initialAuthed} initialRole={role} docsByRole={helpDocsByRole} />
          <NotificationsBell initialAuthed={initialAuthed} initialRole={role} />
          <ProductUpdatesBell initialAuthed={initialAuthed} />
          <NavAuthClient initialAuthed={initialAuthed} />
          <NavMobileDrawerClient
            links={MAIN_NAV_LINKS}
            initialAuthed={initialAuthed}
            initialRole={role}
            marketSelectorEnabled={marketSelectorEnabled}
          />
        </div>
      </div>
      <ProductUpdatesOnboarding initialAuthed={initialAuthed} />
    </header>
  );
}
