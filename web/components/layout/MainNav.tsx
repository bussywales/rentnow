import Image from "next/image";
import Link from "next/link";
import { NavAuthClient } from "@/components/layout/NavAuthClient";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

const links: Array<{
  href: string;
  label: string;
  requireAuth?: boolean;
  requireRole?: UserRole | "super_admin";
}> = [
  { href: "/properties", label: "Browse" },
  { href: "/favourites", label: "Saved", requireAuth: true },
  { href: "/dashboard", label: "Dashboard", requireAuth: true },
  { href: "/admin", label: "Admin", requireAuth: true, requireRole: "admin" },
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
          role = profile?.role as UserRole | "super_admin" | null;
        }
      }
    } catch (err) {
      console.warn("Unable to resolve initial auth state", err);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Image
            src="/logo.svg"
            alt="RENTNOW"
            width={28}
            height={28}
            priority
          />
          <span className="text-xl text-sky-600">RENTNOW</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-slate-700 md:flex">
          {links
            .filter((link) => {
              if (link.requireAuth && !initialAuthed) return false;
              if (link.requireRole && role !== link.requireRole && role !== "super_admin") {
                return false;
              }
              return true;
            })
            .map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={link.requireAuth || link.requireRole ? false : undefined}
                className="transition hover:text-sky-600"
              >
                {link.label}
              </Link>
            ))}
        </nav>

        <div className="flex items-center gap-2">
          <NavAuthClient initialAuthed={initialAuthed} />
        </div>
      </div>
    </header>
  );
}
