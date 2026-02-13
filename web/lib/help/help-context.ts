import type { UserRole } from "@/lib/types";

export type HelpContextRole = "tenant" | "landlord" | "agent" | "admin";

export type HelpContext = {
  role: HelpContextRole;
  slug: string;
  section: string;
};

export type HelpContextLink = {
  role: HelpContextRole;
  slug: string;
  section: string;
};

const DEFAULT_SLUG_BY_ROLE: Record<HelpContextRole, string> = {
  tenant: "getting-started",
  landlord: "getting-started",
  agent: "getting-started",
  admin: "getting-started",
};

const RELATED_SLUGS_BY_ROLE: Record<HelpContextRole, Array<{ slug: string; section: string }>> = {
  tenant: [
    { slug: "getting-started", section: "Getting started" },
    { slug: "core-workflows", section: "Search and filters" },
    { slug: "alerts-and-notifications", section: "Saved search alerts" },
    { slug: "verification", section: "Verification" },
    { slug: "troubleshooting", section: "Troubleshooting" },
    { slug: "success-tips", section: "Success tips" },
  ],
  landlord: [
    { slug: "getting-started", section: "Dashboard basics" },
    { slug: "core-workflows", section: "Listing workflow" },
    { slug: "featured-and-payments", section: "Featured workflow" },
    { slug: "verification", section: "Verification" },
    { slug: "troubleshooting", section: "Troubleshooting" },
    { slug: "success-tips", section: "Success tips" },
  ],
  agent: [
    { slug: "getting-started", section: "Dashboard basics" },
    { slug: "core-workflows", section: "Portfolio workflow" },
    { slug: "featured-and-payments", section: "Featured workflow" },
    { slug: "verification", section: "Verification" },
    { slug: "troubleshooting", section: "Troubleshooting" },
    { slug: "success-tips", section: "Success tips" },
  ],
  admin: [
    { slug: "getting-started", section: "Admin overview" },
    { slug: "ops", section: "Operations" },
    { slug: "core-workflows", section: "Approvals and queues" },
    { slug: "verification", section: "Verification policy" },
    { slug: "troubleshooting", section: "Troubleshooting" },
    { slug: "success-tips", section: "Success tips" },
  ],
};

function normalizeRole(inputRole: UserRole | "super_admin" | string | null | undefined): HelpContextRole {
  if (inputRole === "admin" || inputRole === "super_admin") return "admin";
  if (inputRole === "agent") return "agent";
  if (inputRole === "landlord") return "landlord";
  return "tenant";
}

function hostRole(inputRole: UserRole | "super_admin" | string | null | undefined): HelpContextRole {
  const normalized = normalizeRole(inputRole);
  if (normalized === "agent") return "agent";
  return "landlord";
}

export function resolveHelpContext(input: {
  pathname: string;
  role: UserRole | "super_admin" | string | null | undefined;
}): HelpContext {
  const pathname = input.pathname || "/";
  const normalizedRole = normalizeRole(input.role);

  if (pathname.startsWith("/admin/alerts")) {
    return { role: "admin", slug: "ops", section: "Alerts operations" };
  }
  if (pathname.startsWith("/admin/payments")) {
    return { role: "admin", slug: "ops", section: "Payments operations" };
  }
  if (pathname.startsWith("/admin/featured/requests")) {
    return { role: "admin", slug: "ops", section: "Featured requests queue" };
  }
  if (pathname.startsWith("/admin/settings")) {
    return { role: "admin", slug: "core-workflows", section: "Admin settings" };
  }
  if (pathname.startsWith("/admin/system")) {
    return { role: "admin", slug: "getting-started", section: "System health" };
  }
  if (pathname.startsWith("/admin")) {
    return { role: "admin", slug: "getting-started", section: "Admin overview" };
  }
  if (pathname.startsWith("/host")) {
    return {
      role: hostRole(input.role),
      slug: "getting-started",
      section: "Host workspace",
    };
  }
  if (pathname.startsWith("/home")) {
    return {
      role: hostRole(input.role),
      slug: "getting-started",
      section: "Home workspace",
    };
  }
  if (pathname.startsWith("/tenant/home")) {
    return {
      role: "tenant",
      slug: "getting-started",
      section: "Tenant home",
    };
  }
  if (pathname.startsWith("/properties")) {
    return {
      role: "tenant",
      slug: "core-workflows",
      section: "Search and filters",
    };
  }
  if (pathname.startsWith("/account/verification")) {
    return {
      role: normalizedRole,
      slug: "verification",
      section: "Verification",
    };
  }

  return {
    role: normalizedRole,
    slug: DEFAULT_SLUG_BY_ROLE[normalizedRole],
    section: "Help overview",
  };
}

export function getRelatedHelpLinks(input: {
  role: HelpContextRole;
  currentSlug: string;
}): HelpContextLink[] {
  const links = RELATED_SLUGS_BY_ROLE[input.role] ?? [];
  return links
    .filter((entry) => entry.slug !== input.currentSlug)
    .slice(0, 4)
    .map((entry) => ({
      role: input.role,
      slug: entry.slug,
      section: entry.section,
    }));
}
