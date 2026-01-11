"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { normalizeRole } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

type NavLink = {
  href: string;
  label: string;
  requireAuth?: boolean;
  requireRole?: UserRole | "super_admin";
  denyRoles?: UserRole[];
};

type Props = {
  links: NavLink[];
  initialAuthed: boolean;
  initialRole: UserRole | "super_admin" | null;
};

export function NavLinksClient({ links, initialAuthed, initialRole }: Props) {
  const [isAuthed, setIsAuthed] = useState(initialAuthed);
  const normalizedInitialRole =
    initialRole === "super_admin" ? "super_admin" : normalizeRole(initialRole);
  const [role, setRole] = useState<UserRole | "super_admin" | null>(
    normalizedInitialRole
  );

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const syncRole = async (userId?: string | null) => {
      if (!userId) {
        setRole(null);
        return;
      }
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();
        const normalizedRole = normalizeRole(profile?.role);
        setRole(normalizedRole ?? null);
      } catch {
        setRole(null);
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: { user?: { id: string } } | null } }) => {
        const session = data.session;
        const authed = !!session?.user;
        setIsAuthed(authed);
        syncRole(session?.user?.id ?? null).catch(() => undefined);
      })
      .catch(() => undefined);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
      const authed = !!session?.user;
      setIsAuthed(authed);
      syncRole(session?.user?.id ?? null).catch(() => undefined);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      {links
        .filter((link) => {
          if (link.requireAuth && !isAuthed) return false;
          if (link.requireRole && role !== link.requireRole && role !== "super_admin") {
            return false;
          }
          if (
            link.denyRoles?.length &&
            role &&
            role !== "super_admin" &&
            link.denyRoles.includes(role)
          ) {
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
    </>
  );
}
