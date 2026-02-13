import type { VerificationRequirements } from "@/lib/trust-markers";
import type { VerificationStatus } from "@/lib/verification/status";
import { isVerificationCompleteForRequirements } from "@/lib/verification/center";

export type ChecklistStatus = "done" | "todo" | "coming_soon";

export type ChecklistItem = {
  id: string;
  label: string;
  href: string;
  status: ChecklistStatus;
  note?: string | null;
};

export function resolveChecklistStatus(done: boolean): ChecklistStatus {
  return done ? "done" : "todo";
}

export function isVerificationChecklistDone(input: {
  status: Pick<VerificationStatus, "email" | "phone" | "bank">;
  requirements: VerificationRequirements;
}) {
  return isVerificationCompleteForRequirements(input.status, input.requirements);
}

export function buildTenantChecklist(input: {
  verificationDone: boolean;
  hasSavedSearch: boolean;
  alertsEnabled: boolean;
  hasCollection: boolean;
  hasContactedHost: boolean;
}): ChecklistItem[] {
  return [
    {
      id: "tenant-verification",
      label: "Complete verification",
      href: "/account/verification",
      status: resolveChecklistStatus(input.verificationDone),
    },
    {
      id: "tenant-saved-search",
      label: "Save a search",
      href: "/properties",
      status: resolveChecklistStatus(input.hasSavedSearch),
    },
    {
      id: "tenant-alerts",
      label: "Enable alerts",
      href: "/tenant/saved-searches",
      status: resolveChecklistStatus(input.alertsEnabled),
    },
    {
      id: "tenant-collection",
      label: "Create a collection",
      href: "/favourites",
      status: resolveChecklistStatus(input.hasCollection),
    },
    {
      id: "tenant-contact",
      label: "Contact a host or agent",
      href: "/dashboard/messages",
      status: resolveChecklistStatus(input.hasContactedHost),
    },
  ];
}

export function buildHostChecklist(input: {
  role: "agent" | "landlord";
  verificationDone: boolean;
  profileComplete: boolean;
  hasListing: boolean;
  hasMinPhotos: boolean;
  hasSubmittedForApproval: boolean;
  hasRespondedToEnquiries: boolean;
  featuredRequestsEnabled: boolean;
  hasFeaturedRequest: boolean;
  minPhotosRequired: number;
}): ChecklistItem[] {
  const roleLabel = input.role === "agent" ? "agent" : "landlord";
  return [
    {
      id: "host-verification",
      label: "Complete verification",
      href: "/account/verification",
      status: resolveChecklistStatus(input.verificationDone),
    },
    {
      id: "host-profile",
      label: "Complete profile",
      href: "/profile",
      status: resolveChecklistStatus(input.profileComplete),
    },
    {
      id: "host-first-listing",
      label: "Create your first listing",
      href: "/dashboard/properties/new",
      status: resolveChecklistStatus(input.hasListing),
    },
    {
      id: "host-photos",
      label: `Add at least ${input.minPhotosRequired} photos`,
      href: "/host",
      status: resolveChecklistStatus(input.hasMinPhotos),
    },
    {
      id: "host-submit",
      label: "Submit for approval",
      href: "/host",
      status: resolveChecklistStatus(input.hasSubmittedForApproval),
    },
    {
      id: "host-featured",
      label: "Request featured placement",
      href: "/host",
      status: input.featuredRequestsEnabled
        ? resolveChecklistStatus(input.hasFeaturedRequest)
        : "coming_soon",
      note: input.featuredRequestsEnabled
        ? null
        : "Featured requests are paused in admin settings.",
    },
    {
      id: "host-enquiries",
      label: input.role === "agent" ? "Manage leads" : "Respond to enquiries",
      href: "/dashboard/leads",
      status: resolveChecklistStatus(input.hasRespondedToEnquiries),
      note: input.role === "agent" ? `Keep ${roleLabel} response times tight.` : null,
    },
  ];
}

export function buildAdminChecklist(input: {
  pendingApprovals: number;
  pendingFeaturedRequests: number;
  alertsHealthy: boolean;
  hasDraftProductUpdates: boolean;
  systemHealthReady: boolean;
}): ChecklistItem[] {
  return [
    {
      id: "admin-approvals",
      label: "Review approvals",
      href: "/admin/review",
      status: resolveChecklistStatus(input.pendingApprovals === 0),
      note:
        input.pendingApprovals > 0
          ? `${input.pendingApprovals} listing approvals pending.`
          : "No pending approvals.",
    },
    {
      id: "admin-featured",
      label: "Review featured requests",
      href: "/admin/featured/requests",
      status: resolveChecklistStatus(input.pendingFeaturedRequests === 0),
      note:
        input.pendingFeaturedRequests > 0
          ? `${input.pendingFeaturedRequests} featured requests pending.`
          : "No pending featured requests.",
    },
    {
      id: "admin-alerts",
      label: "Review alerts status",
      href: "/admin/alerts",
      status: resolveChecklistStatus(input.alertsHealthy),
    },
    {
      id: "admin-updates",
      label: "Publish product updates",
      href: "/admin/product-updates",
      status: resolveChecklistStatus(!input.hasDraftProductUpdates),
      note: input.hasDraftProductUpdates ? "Draft updates still need publishing." : null,
    },
    {
      id: "admin-health",
      label: "Review system health",
      href: "/admin/system",
      status: resolveChecklistStatus(input.systemHealthReady),
    },
  ];
}

export function summarizeChecklist(items: ChecklistItem[]) {
  const done = items.filter((item) => item.status === "done").length;
  return {
    done,
    total: items.length,
  };
}
