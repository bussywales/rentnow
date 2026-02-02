import { NavAuthClient } from "@/components/layout/NavAuthClient";
import { NavLinksClient } from "@/components/layout/NavLinksClient";
import { NavMobileDrawerClient } from "@/components/layout/NavMobileDrawerClient";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import { normalizeRole } from "@/lib/roles";

export const MAIN_NAV_LINKS: Array<{
  href: string;
  label: string;
  requireAuth?: boolean;
  requireRole?: UserRole | "super_admin";
  denyRoles?: UserRole[];
}> = [
  { href: "/properties", label: "Browse" },
  { href: "/favourites", label: "Saved", requireAuth: true },
  {
    href: "/tenant/saved-searches",
    label: "Saved searches",
    requireAuth: true,
    requireRole: "tenant",
  },
  { href: "/tenant", label: "Dashboard", requireAuth: true, requireRole: "tenant" },
  { href: "/dashboard", label: "Dashboard", requireAuth: true, denyRoles: ["tenant", "admin"] },
  { href: "/admin", label: "Admin", requireAuth: true, requireRole: "admin" },
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
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <BrandLogo variant="minimal" size="sm" className="sm:hidden" />
          <BrandLogo variant="header" size="md" className="hidden sm:inline-flex" />
        </div>

        <nav className="hidden items-center gap-6 text-sm text-slate-700 md:flex">
          <NavLinksClient links={MAIN_NAV_LINKS} initialAuthed={initialAuthed} initialRole={role} />
        </nav>

        <div className="flex items-center gap-2">
          <NavMobileDrawerClient links={MAIN_NAV_LINKS} initialAuthed={initialAuthed} initialRole={role} />
          <NavAuthClient initialAuthed={initialAuthed} initialRole={role} />
        </div>
      </div>
    </header>
  );
}
