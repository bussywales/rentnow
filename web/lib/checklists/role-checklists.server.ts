import type { SupabaseClient } from "@supabase/supabase-js";
import { getAlertsLastRunStatus, getVerificationRequirements } from "@/lib/settings/app-settings.server";
import { getVerificationStatus } from "@/lib/verification/status";
import { getFeaturedEligibilitySettings } from "@/lib/featured/eligibility.server";
import { getSystemHealthEnvStatus } from "@/lib/admin/system-health";
import {
  buildAdminChecklist,
  buildHostChecklist,
  buildTenantChecklist,
  isVerificationChecklistDone,
  type ChecklistItem,
} from "@/lib/checklists/role-checklists";

type CountResult = {
  count?: number | null;
  error?: { message?: string } | null;
};

async function toCount(queryPromise: PromiseLike<CountResult> | Promise<CountResult>): Promise<number> {
  try {
    const result = await queryPromise;
    if (result?.error) return 0;
    return Math.max(0, result?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function loadTenantChecklist(input: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<ChecklistItem[]> {
  const [status, requirements, savedSearchCount, enabledAlertsCount, collectionCount, threadCount] =
    await Promise.all([
      getVerificationStatus({ userId: input.userId }),
      getVerificationRequirements(input.supabase),
      toCount(
        input.supabase
          .from("saved_searches")
          .select("id", { count: "exact", head: true })
          .eq("user_id", input.userId)
      ),
      toCount(
        input.supabase
          .from("saved_searches")
          .select("id", { count: "exact", head: true })
          .eq("user_id", input.userId)
          .eq("is_active", true)
          .eq("alerts_enabled", true)
      ),
      toCount(
        input.supabase
          .from("saved_collections")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", input.userId)
      ),
      toCount(
        input.supabase
          .from("message_threads")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", input.userId)
      ),
    ]);

  return buildTenantChecklist({
    verificationDone: isVerificationChecklistDone({ status, requirements }),
    hasSavedSearch: savedSearchCount > 0,
    alertsEnabled: enabledAlertsCount > 0,
    hasCollection: collectionCount > 0,
    hasContactedHost: threadCount > 0,
  });
}

type OwnerListingRow = {
  id: string;
  status?: string | null;
  is_featured?: boolean | null;
};

type OwnerProfileRow = {
  full_name?: string | null;
  display_name?: string | null;
  business_name?: string | null;
  phone?: string | null;
};

export async function loadHostChecklist(input: {
  supabase: SupabaseClient;
  userId: string;
  role: "agent" | "landlord";
}): Promise<ChecklistItem[]> {
  const [status, requirements, featuredSettings, ownerProfile, ownerListings, respondedCount, featuredRequestCount] =
    await Promise.all([
      getVerificationStatus({ userId: input.userId }),
      getVerificationRequirements(input.supabase),
      getFeaturedEligibilitySettings(input.supabase),
      input.supabase
        .from("profiles")
        .select("full_name, display_name, business_name, phone")
        .eq("id", input.userId)
        .maybeSingle<OwnerProfileRow>(),
      input.supabase
        .from("properties")
        .select("id, status, is_featured")
        .eq("owner_id", input.userId),
      toCount(
        input.supabase
          .from("message_threads")
          .select("id", { count: "exact", head: true })
          .eq("host_id", input.userId)
      ),
      toCount(
        input.supabase
          .from("featured_requests")
          .select("id", { count: "exact", head: true })
          .eq("requester_user_id", input.userId)
          .in("status", ["pending", "approved"])
      ),
    ]);

  const listings = (ownerListings.data as OwnerListingRow[] | null) ?? [];
  const listingIds = listings.map((listing) => listing.id).filter(Boolean);
  const { data: imageRows } = listingIds.length
    ? await input.supabase
        .from("property_images")
        .select("property_id")
        .in("property_id", listingIds)
    : { data: [] as Array<{ property_id?: string | null }> };

  const photoCountByListing = new Map<string, number>();
  for (const row of ((imageRows as Array<{ property_id?: string | null }> | null) ?? [])) {
    const propertyId = typeof row.property_id === "string" ? row.property_id : "";
    if (!propertyId) continue;
    photoCountByListing.set(propertyId, (photoCountByListing.get(propertyId) ?? 0) + 1);
  }

  const hasMinPhotos = listingIds.some(
    (listingId) => (photoCountByListing.get(listingId) ?? 0) >= featuredSettings.minPhotos
  );
  const hasSubmittedForApproval = listings.some((listing) => {
    const normalized = String(listing.status || "").trim().toLowerCase();
    return normalized.length > 0 && normalized !== "draft";
  });
  const hasFeaturedRequest =
    featuredRequestCount > 0 || listings.some((listing) => listing.is_featured === true);
  const profile = ownerProfile.data as OwnerProfileRow | null;
  const profileComplete =
    Boolean(profile?.phone?.trim()) &&
    Boolean((profile?.display_name || profile?.business_name || profile?.full_name || "").trim());

  return buildHostChecklist({
    role: input.role,
    verificationDone: isVerificationChecklistDone({ status, requirements }),
    profileComplete,
    hasListing: listings.length > 0,
    hasMinPhotos,
    hasSubmittedForApproval,
    hasRespondedToEnquiries: respondedCount > 0,
    featuredRequestsEnabled: featuredSettings.requestsEnabled,
    hasFeaturedRequest,
    minPhotosRequired: featuredSettings.minPhotos,
  });
}

export type AdminVerificationRollup = {
  missingEmail: number | null;
  missingPhone: number | null;
  missingBank: number | null;
};

export async function loadAdminChecklist(input: {
  supabase: SupabaseClient;
}): Promise<ChecklistItem[]> {
  const [pendingApprovals, pendingFeaturedRequests, draftUpdatesCount, alertsStatus] = await Promise.all([
    toCount(
      input.supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
    ),
    toCount(
      input.supabase
        .from("featured_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
    ),
    toCount(
      input.supabase
        .from("product_updates")
        .select("id", { count: "exact", head: true })
        .is("published_at", null)
    ),
    getAlertsLastRunStatus(input.supabase),
  ]);
  const env = getSystemHealthEnvStatus();
  const alertsHealthy = Boolean(alertsStatus?.ran_at_utc) && !alertsStatus?.disabled_reason;
  const systemHealthReady =
    env.resendApiKeyPresent && env.cronSecretPresent && env.paystackSecretKeyPresent;

  return buildAdminChecklist({
    pendingApprovals,
    pendingFeaturedRequests,
    hasDraftProductUpdates: draftUpdatesCount > 0,
    alertsHealthy,
    systemHealthReady,
  });
}

export async function loadAdminVerificationRollup(input: {
  supabase: SupabaseClient;
}): Promise<AdminVerificationRollup> {
  const roleFilter = ["landlord", "agent"];
  const [missingEmail, missingPhone, missingBank] = await Promise.all([
    toCount(
      input.supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", roleFilter)
        .neq("email_verified", true)
    ),
    toCount(
      input.supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", roleFilter)
        .neq("phone_verified", true)
    ),
    toCount(
      input.supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", roleFilter)
        .neq("bank_verified", true)
    ),
  ]);
  return {
    missingEmail,
    missingPhone,
    missingBank,
  };
}
