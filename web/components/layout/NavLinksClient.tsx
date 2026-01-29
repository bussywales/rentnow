"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function resolveNavLinks(
  links: NavLink[],
  {
    isAuthed,
    role,
  }: {
    isAuthed: boolean;
    role: UserRole | "super_admin" | null;
  }
): NavLink[] {
  const effectiveRoleForDeny = role === "super_admin" ? "admin" : role;
  return links.filter((link) => {
    if (link.requireAuth && !isAuthed) return false;
    if (link.requireRole && role !== link.requireRole && role !== "super_admin") {
      return false;
    }
    if (
      link.denyRoles?.length &&
      effectiveRoleForDeny &&
      link.denyRoles.includes(effectiveRoleForDeny)
    ) {
      return false;
    }
    return true;
  });
}

function isActiveHref(pathname: string, href: string) {
  if (href === "/admin") {
    if (pathname === "/admin") return true;
    if (!pathname.startsWith("/admin/")) return false;
    return !pathname.startsWith("/admin/support") && !pathname.startsWith("/admin/settings");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinksClient({ links, initialAuthed, initialRole }: Props) {
  const normalizedInitialRole =
    initialRole === "super_admin" ? "super_admin" : normalizeRole(initialRole);
  const role = normalizedInitialRole;
  const isAuthed = initialAuthed;
  const pathname = usePathname() ?? "/";

  return (
    <>
      {resolveNavLinks(links, { isAuthed, role }).map((link) => {
        const active = isActiveHref(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch={link.requireAuth || link.requireRole ? false : undefined}
            aria-current={active ? "page" : undefined}
            className={`transition hover:text-sky-600 ${
              active ? "font-semibold text-slate-900" : "text-slate-700"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
