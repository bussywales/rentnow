"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

type NavLink = {
  href: string;
  label: string;
  requireAuth?: boolean;
  requireRole?: UserRole | "super_admin";
};

type Props = {
  links: NavLink[];
  initialAuthed: boolean;
  initialRole: UserRole | "super_admin" | null;
};

export function NavLinksClient({ links, initialAuthed, initialRole }: Props) {
  const [isAuthed, setIsAuthed] = useState(initialAuthed);
  const [role, setRole] = useState<UserRole | "super_admin" | null>(initialRole);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth
      .getSession()
      .then(
        ({ data }: { data: { session: { user?: { id: string } } | null } }) => {
          const session = data.session;
          const authed = !!session?.user;
          setIsAuthed(authed);
          if (authed && session?.user?.id && !role) {
            const userId = session.user.id;
            supabase
              .from("profiles")
              .select("role")
              .eq("id", userId)
              .maybeSingle()
              .then(({ data: profile }: { data: { role?: string } | null }) => {
                if (profile?.role) {
                  setRole(profile.role as UserRole);
                }
              })
              .catch(() => undefined);
          }
        }
      )
      .catch(() => undefined);
  }, [role]);

  return (
    <>
      {links
        .filter((link) => {
          if (link.requireAuth && !isAuthed) return false;
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
    </>
  );
}
