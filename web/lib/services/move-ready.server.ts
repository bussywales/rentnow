import { buildShareToken } from "@/lib/messaging/share";
import { getSiteUrl } from "@/lib/env";
import { buildMoveReadyProviderLeadEmail } from "@/lib/email/templates/move-ready-provider-lead";
import {
  MOVE_READY_MAX_PROVIDER_MATCHES,
  type MoveReadyLeadStatus,
  type MoveReadyProviderApplicationStatus,
  type MoveReadyProviderVerificationState,
  type MoveReadyProviderStatus,
  type MoveReadyServiceCategory,
  resolveMoveReadyProviderApplicationStatus,
} from "@/lib/services/move-ready";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type MoveReadyProviderRecord = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  verification_state: MoveReadyProviderVerificationState;
  provider_status: MoveReadyProviderStatus;
  verification_reference?: string | null;
  admin_notes?: string | null;
  notes?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  suspended_at?: string | null;
  suspended_by?: string | null;
  move_ready_provider_categories?: Array<{ category: MoveReadyServiceCategory | string | null }> | null;
  move_ready_provider_areas?: Array<{ market_code: string; city: string | null; area: string | null }> | null;
};

export type MoveReadyRequestMatchInput = {
  category: MoveReadyServiceCategory;
  marketCode: string;
  city?: string | null;
  area?: string | null;
};

function normalizeLocationValue(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function doesProviderAreaMatchRequest(
  area: { market_code: string; city: string | null; area: string | null },
  request: MoveReadyRequestMatchInput
) {
  if (normalizeLocationValue(area.market_code) !== normalizeLocationValue(request.marketCode)) {
    return false;
  }

  if (area.city && normalizeLocationValue(area.city) !== normalizeLocationValue(request.city)) {
    return false;
  }

  if (area.area && normalizeLocationValue(area.area) !== normalizeLocationValue(request.area)) {
    return false;
  }

  return true;
}

export function filterEligibleMoveReadyProviders(
  providers: MoveReadyProviderRecord[],
  request: MoveReadyRequestMatchInput
) {
  return providers
    .filter((provider) => provider.provider_status === "active" && provider.verification_state === "approved")
    .filter((provider) =>
      (provider.move_ready_provider_categories ?? []).some(
        (entry) => normalizeLocationValue(entry.category) === normalizeLocationValue(request.category)
      )
    )
    .filter((provider) =>
      (provider.move_ready_provider_areas ?? []).some((area) => doesProviderAreaMatchRequest(area, request))
    )
    .slice(0, MOVE_READY_MAX_PROVIDER_MATCHES);
}

export type MoveReadyRoutingReadiness = {
  eligibleApprovedProviderCount: number;
  status: "route_ready" | "manual_routing_required";
  reason:
    | "approved_suppliers_available"
    | "no_approved_suppliers_for_category"
    | "no_approved_suppliers_in_market"
    | "no_approved_suppliers_in_area";
};

function isApprovedAndActive(provider: MoveReadyProviderRecord) {
  return provider.provider_status === "active" && provider.verification_state === "approved";
}

export function assessMoveReadyRoutingReadiness(
  providers: MoveReadyProviderRecord[],
  request: MoveReadyRequestMatchInput
): MoveReadyRoutingReadiness {
  const approvedProviders = providers.filter(isApprovedAndActive);
  const categoryProviders = approvedProviders.filter((provider) =>
    (provider.move_ready_provider_categories ?? []).some(
      (entry) => normalizeLocationValue(entry.category) === normalizeLocationValue(request.category)
    )
  );
  const marketProviders = categoryProviders.filter((provider) =>
    (provider.move_ready_provider_areas ?? []).some(
      (area) => normalizeLocationValue(area.market_code) === normalizeLocationValue(request.marketCode)
    )
  );
  const eligibleProviders = filterEligibleMoveReadyProviders(approvedProviders, request);

  if (eligibleProviders.length > 0) {
    return {
      eligibleApprovedProviderCount: eligibleProviders.length,
      status: "route_ready",
      reason: "approved_suppliers_available",
    };
  }

  if (marketProviders.length > 0) {
    return {
      eligibleApprovedProviderCount: 0,
      status: "manual_routing_required",
      reason: "no_approved_suppliers_in_area",
    };
  }

  if (categoryProviders.length > 0) {
    return {
      eligibleApprovedProviderCount: 0,
      status: "manual_routing_required",
      reason: "no_approved_suppliers_in_market",
    };
  }

  return {
    eligibleApprovedProviderCount: 0,
    status: "manual_routing_required",
    reason: "no_approved_suppliers_for_category",
  };
}

export function getMoveReadyRoutingReadinessLabel(readiness: MoveReadyRoutingReadiness) {
  if (readiness.status === "route_ready") {
    return `${readiness.eligibleApprovedProviderCount} approved supplier${
      readiness.eligibleApprovedProviderCount === 1 ? "" : "s"
    } match`;
  }

  switch (readiness.reason) {
    case "no_approved_suppliers_in_area":
      return "Needs manual routing: no approved suppliers in this area";
    case "no_approved_suppliers_in_market":
      return "Needs manual routing: no approved suppliers in this market";
    case "no_approved_suppliers_for_category":
    default:
      return "Needs manual routing: no approved suppliers for this category";
  }
}

export function getMoveReadyProviderAdminLifecycle(input: {
  verificationState: MoveReadyProviderVerificationState | string | null | undefined;
  providerStatus: MoveReadyProviderStatus | string | null | undefined;
}): MoveReadyProviderApplicationStatus {
  return resolveMoveReadyProviderApplicationStatus(input);
}

export function buildMoveReadyLeadToken() {
  return buildShareToken();
}

export async function buildMoveReadyLeadResponseUrl(token: string) {
  const siteUrl = await getSiteUrl();
  return `${siteUrl}/services/respond/${token}`;
}

export async function sendMoveReadyLeadEmail(input: {
  provider: {
    businessName: string;
    email: string;
  };
  request: {
    category: string;
    marketCode: string;
    city?: string | null;
    area?: string | null;
    propertyTitle?: string | null;
    preferredTimingText?: string | null;
    contextNotes: string;
    requesterRole: string;
  };
  responseToken: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false as const, error: "resend_not_configured" };

  const responseUrl = await buildMoveReadyLeadResponseUrl(input.responseToken);
  const { subject, html } = buildMoveReadyProviderLeadEmail({
    providerBusinessName: input.provider.businessName,
    category: input.request.category,
    marketCode: input.request.marketCode,
    city: input.request.city ?? null,
    area: input.request.area ?? null,
    propertyTitle: input.request.propertyTitle ?? null,
    preferredTimingText: input.request.preferredTimingText ?? null,
    contextNotes: input.request.contextNotes,
    requesterRole: input.request.requesterRole,
    responseUrl,
  });

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "PropatyHub <no-reply@propatyhub.com>",
      to: input.provider.email,
      subject,
      html,
    }),
  }).catch(() => null);

  if (!response) return { ok: false as const, error: "resend_request_failed" };
  if (!response.ok) return { ok: false as const, error: `resend_${response.status}` };
  return { ok: true as const };
}

export function resolveMoveReadyLeadStatusAfterDelivery(input: {
  deliveryOk: boolean;
  accepted?: boolean;
}): MoveReadyLeadStatus {
  if (!input.deliveryOk) return "delivery_failed";
  if (input.accepted === true) return "accepted";
  return "sent";
}
