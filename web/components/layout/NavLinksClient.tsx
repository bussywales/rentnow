import Link from "next/link";
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
  const normalizedInitialRole =
    initialRole === "super_admin" ? "super_admin" : normalizeRole(initialRole);
  const role = normalizedInitialRole;
  const isAuthed = initialAuthed;

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
        .map((link) => {
          const effectiveHref =
            link.label === "Dashboard" && role === "admin" ? "/admin" : link.href;
          return (
          <Link
            key={link.href}
            href={effectiveHref}
            prefetch={link.requireAuth || link.requireRole ? false : undefined}
            className="transition hover:text-sky-600"
          >
            {link.label}
          </Link>
        );
        })}
    </>
  );
}
