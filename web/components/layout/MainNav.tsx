import { NavAuthClient } from "@/components/layout/NavAuthClient";
import { NavLinksClient } from "@/components/layout/NavLinksClient";
import { NavMobileDrawerClient } from "@/components/layout/NavMobileDrawerClient";
import { NavHamburgerMenu } from "@/components/layout/NavHamburgerMenu";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { AdminHelpDrawer } from "@/components/help/AdminHelpDrawer";
import { ProductUpdatesBell } from "@/components/updates/ProductUpdatesBell";
import { ProductUpdatesOnboarding } from "@/components/updates/ProductUpdatesOnboarding";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import { normalizeRole } from "@/lib/roles";

export const MAIN_NAV_LINKS: Array<{
  href: string;
  label: string;
  testId?: string;
  requireAuth?: boolean;
  requireRole?: UserRole | "super_admin";
  denyRoles?: UserRole[];
}> = [
  { href: "/properties", label: "Browse" },
  { href: "/tenant/saved", label: "Saved", requireAuth: true, requireRole: "tenant" },
  { href: "/favourites", label: "Saved", requireAuth: true, denyRoles: ["tenant"] },
  { href: "/tenant/home", label: "Home", requireAuth: true, requireRole: "tenant" },
  {
    href: "/tenant/saved-searches",
    label: "Saved searches",
    requireAuth: true,
    requireRole: "tenant",
  },
  { href: "/tenant", label: "Dashboard", requireAuth: true, requireRole: "tenant" },
  { href: "/dashboard", label: "Dashboard", requireAuth: true, denyRoles: ["tenant", "admin"] },
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

export async function MainNav() {
  let initialAuthed = false;
  let role: UserRole | "super_admin" | null = null;

  if (hasServerSupabaseEnv()) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.auth.getSession();
      if (!error) {
        initialAuthed = !!data.session;
        const userId = data.session?.user?.id;
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

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur-lg shadow-[0_1px_10px_rgba(15,23,42,0.06)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16">
        <div className="flex items-center">
          <BrandLogo variant="minimal" size="sm" className="sm:hidden" />
          <BrandLogo variant="header" size="md" className="hidden sm:inline-flex" />
        </div>

        <nav className="hidden items-center gap-6 text-sm text-slate-700 md:flex">
          <NavLinksClient links={MAIN_NAV_LINKS} initialAuthed={initialAuthed} initialRole={role} />
        </nav>

        <div className="flex items-center gap-2">
          <AdminHelpDrawer initialAuthed={initialAuthed} initialRole={role} />
          <ProductUpdatesBell initialAuthed={initialAuthed} />
          <NavHamburgerMenu initialAuthed={initialAuthed} initialRole={role} />
          <NavMobileDrawerClient links={MAIN_NAV_LINKS} initialAuthed={initialAuthed} initialRole={role} />
          <NavAuthClient initialAuthed={initialAuthed} initialRole={role} />
        </div>
      </div>
      <ProductUpdatesOnboarding initialAuthed={initialAuthed} />
    </header>
  );
}
