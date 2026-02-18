"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { normalizeRole } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export type NavLink = {
  href: string;
  label: string;
  testId?: string;
  requireAuth?: boolean;
  requireRole?: UserRole | "super_admin";
  denyRoles?: UserRole[];
  badgeCount?: number | null;
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

export function isActiveHref(pathname: string, href: string) {
  const normalizedHref = href.split("?")[0] || href;
  if (href === "/tenant") {
    return pathname === "/tenant";
  }
  if (href === "/tenant/home") {
    return pathname === "/tenant/home";
  }
  if (href === "/admin") {
    if (pathname === "/admin") return true;
    if (!pathname.startsWith("/admin/")) return false;
    return !pathname.startsWith("/admin/support") && !pathname.startsWith("/admin/settings");
  }
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
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
            data-testid={link.testId}
            className={`transition hover:text-sky-600 ${
              active ? "font-semibold text-slate-900" : "text-slate-700"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{link.label}</span>
              {(link.badgeCount ?? 0) > 0 ? (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900">
                  {link.badgeCount}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </>
  );
}
