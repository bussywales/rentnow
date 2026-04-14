import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getPaygConfig } from "@/lib/billing/payg";
import { findAdminAuthUserByEmail } from "@/lib/billing/admin-billing-lookup";
import { issueTrialCreditsIfEligible } from "@/lib/billing/listing-credits.server";
import {
  LISTING_TRANSFER_EXPIRY_DAYS,
  LISTING_TRANSFER_RECIPIENT_ROLES,
  resolveListingTransferExpiresAt,
  resolveListingTransferRequiresEntitlement,
  type ListingTransferStatus,
} from "@/lib/properties/listing-ownership-transfer";
import type { PropertyStatus, UserRole } from "@/lib/types";

export type ListingTransferFailureCode =
  | "SERVER_ERROR"
  | "LISTING_NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_RECIPIENT"
  | "RECIPIENT_ROLE_INVALID"
  | "SELF_TRANSFER"
  | "PENDING_EXISTS"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_NOT_PENDING"
  | "REQUEST_EXPIRED"
  | "NOT_RECIPIENT"
  | "NOT_INITIATOR"
  | "ACTIVE_SHORTLET_BOOKINGS"
  | "MESSAGE_THREAD_CONFLICT"
  | "OWNER_CHANGED"
  | "BILLING_REQUIRED"
  | "PAYMENT_REQUIRED"
  | "NO_CREDITS"
  | "INVALID_STATE";

export type ListingTransferRequestRecord = {
  id: string;
  property_id: string;
  from_owner_id: string;
  to_owner_id: string;
  initiator_user_id: string;
  recipient_email: string;
  status: ListingTransferStatus;
  created_at: string;
  updated_at: string;
  responded_at?: string | null;
  expires_at: string;
  accepted_by_user_id?: string | null;
  rejected_by_user_id?: string | null;
  cancelled_by_user_id?: string | null;
  last_failure_code?: string | null;
  last_failure_reason?: string | null;
  last_failed_at?: string | null;
  property?: {
    id: string;
    title?: string | null;
    city?: string | null;
    status?: string | null;
    listing_intent?: string | null;
  } | null;
  from_owner?: {
    id?: string | null;
    full_name?: string | null;
    display_name?: string | null;
    business_name?: string | null;
    role?: UserRole | null;
  } | null;
  to_owner?: {
    id?: string | null;
    full_name?: string | null;
    display_name?: string | null;
    business_name?: string | null;
    role?: UserRole | null;
  } | null;
};

type TransferPropertyRow = {
  id: string;
  title?: string | null;
  city?: string | null;
  owner_id: string;
  status?: PropertyStatus | null;
  listing_intent?: string | null;
};

type TransferProfileRow = {
  id: string;
  role?: UserRole | null;
  full_name?: string | null;
  display_name?: string | null;
  business_name?: string | null;
};

type TransferRpcPayload = {
  ok?: boolean;
  code?: string | null;
  message?: string | null;
  property_id?: string | null;
  new_owner_id?: string | null;
  status?: string | null;
};

type CreateTransferResult =
  | { ok: true; request: ListingTransferRequestRecord }
  | { ok: false; code: ListingTransferFailureCode; error: string };

type RespondTransferResult =
  | { ok: true; request: ListingTransferRequestRecord }
  | {
      ok: false;
      code: ListingTransferFailureCode;
      error: string;
      billingUrl?: string;
      reason?: "BILLING_REQUIRED" | "PAYMENT_REQUIRED";
      amount?: number;
      currency?: string;
    };

function createTransferClient() {
  if (!hasServiceRoleEnv()) {
    throw new Error("Service role not configured");
  }
  return createServiceRoleClient() as unknown as SupabaseClient;
}

function unwrapJoinedRecord<T extends Record<string, unknown>>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeTransferRequestRecord(raw: Record<string, unknown>): ListingTransferRequestRecord {
  const property = unwrapJoinedRecord(raw.property as Record<string, unknown> | Record<string, unknown>[] | null | undefined);
  const fromOwner = unwrapJoinedRecord(raw.from_owner as Record<string, unknown> | Record<string, unknown>[] | null | undefined);
  const toOwner = unwrapJoinedRecord(raw.to_owner as Record<string, unknown> | Record<string, unknown>[] | null | undefined);

  return {
    ...(raw as Omit<ListingTransferRequestRecord, "property" | "from_owner" | "to_owner">),
    property: property
      ? {
          id: String(property.id),
          title: typeof property.title === "string" ? property.title : null,
          city: typeof property.city === "string" ? property.city : null,
          status: typeof property.status === "string" ? property.status : null,
          listing_intent: typeof property.listing_intent === "string" ? property.listing_intent : null,
        }
      : null,
    from_owner: fromOwner
      ? {
          id: typeof fromOwner.id === "string" ? fromOwner.id : null,
          full_name: typeof fromOwner.full_name === "string" ? fromOwner.full_name : null,
          display_name: typeof fromOwner.display_name === "string" ? fromOwner.display_name : null,
          business_name: typeof fromOwner.business_name === "string" ? fromOwner.business_name : null,
          role: typeof fromOwner.role === "string" ? (fromOwner.role as UserRole) : null,
        }
      : null,
    to_owner: toOwner
      ? {
          id: typeof toOwner.id === "string" ? toOwner.id : null,
          full_name: typeof toOwner.full_name === "string" ? toOwner.full_name : null,
          display_name: typeof toOwner.display_name === "string" ? toOwner.display_name : null,
          business_name: typeof toOwner.business_name === "string" ? toOwner.business_name : null,
          role: typeof toOwner.role === "string" ? (toOwner.role as UserRole) : null,
        }
      : null,
  };
}

function normalizeTransferRequestRecords(rows: Record<string, unknown>[] | null | undefined): ListingTransferRequestRecord[] {
  return (rows ?? []).map((row) => normalizeTransferRequestRecord(row));
}

function formatProfileName(profile: TransferProfileRow | null | undefined) {
  return (
    profile?.display_name?.trim() ||
    profile?.business_name?.trim() ||
    profile?.full_name?.trim() ||
    null
  );
}

export function resolveListingTransferBillingUrl(role?: UserRole | null) {
  return role === "tenant" ? "/tenant/billing#plans" : "/dashboard/billing#plans";
}

export async function expireStaleListingTransferRequests(client: SupabaseClient) {
  const nowIso = new Date().toISOString();
  await client
    .from("listing_transfer_requests")
    .update({
      status: "expired",
      responded_at: nowIso,
      updated_at: nowIso,
      last_failure_code: "REQUEST_EXPIRED",
      last_failure_reason: "Transfer request expired before acceptance.",
      last_failed_at: nowIso,
    })
    .eq("status", "pending")
    .lt("expires_at", nowIso);
}

async function selectTransferRequestById(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from("listing_transfer_requests")
    .select(
      `id, property_id, from_owner_id, to_owner_id, initiator_user_id, recipient_email, status, created_at, updated_at, responded_at, expires_at, accepted_by_user_id, rejected_by_user_id, cancelled_by_user_id, last_failure_code, last_failure_reason, last_failed_at,
      property:properties(id, title, city, status, listing_intent),
      from_owner:profiles!listing_transfer_requests_from_owner_id_fkey(id, full_name, display_name, business_name, role),
      to_owner:profiles!listing_transfer_requests_to_owner_id_fkey(id, full_name, display_name, business_name, role)`
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load transfer request.");
  }

  return data ? normalizeTransferRequestRecord(data as Record<string, unknown>) : null;
}

export async function getListingTransferPanelState(input: {
  propertyId: string;
  ownerId: string;
}) {
  const client = createTransferClient();
  await expireStaleListingTransferRequests(client);

  const { data, error } = await client
    .from("listing_transfer_requests")
    .select(
      `id, property_id, from_owner_id, to_owner_id, initiator_user_id, recipient_email, status, created_at, updated_at, responded_at, expires_at, accepted_by_user_id, rejected_by_user_id, cancelled_by_user_id, last_failure_code, last_failure_reason, last_failed_at,
      property:properties(id, title, city, status, listing_intent),
      from_owner:profiles!listing_transfer_requests_from_owner_id_fkey(id, full_name, display_name, business_name, role),
      to_owner:profiles!listing_transfer_requests_to_owner_id_fkey(id, full_name, display_name, business_name, role)`
    )
    .eq("property_id", input.propertyId)
    .eq("from_owner_id", input.ownerId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(error.message || "Unable to load listing transfer state.");
  }

  return normalizeTransferRequestRecords(data as Record<string, unknown>[] | null);
}

export async function listListingTransferRequestsForUser(userId: string) {
  const client = createTransferClient();
  await expireStaleListingTransferRequests(client);

  const { data, error } = await client
    .from("listing_transfer_requests")
    .select(
      `id, property_id, from_owner_id, to_owner_id, initiator_user_id, recipient_email, status, created_at, updated_at, responded_at, expires_at, accepted_by_user_id, rejected_by_user_id, cancelled_by_user_id, last_failure_code, last_failure_reason, last_failed_at,
      property:properties(id, title, city, status, listing_intent),
      from_owner:profiles!listing_transfer_requests_from_owner_id_fkey(id, full_name, display_name, business_name, role),
      to_owner:profiles!listing_transfer_requests_to_owner_id_fkey(id, full_name, display_name, business_name, role)`
    )
    .or(`from_owner_id.eq.${userId},to_owner_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message || "Unable to load listing transfer requests.");
  }

  const rows = normalizeTransferRequestRecords(data as Record<string, unknown>[] | null);

  return {
    incoming: rows.filter((row) => row.to_owner_id === userId),
    outgoing: rows.filter((row) => row.from_owner_id === userId),
  };
}

export async function listAdminListingTransferRequests() {
  const client = createTransferClient();
  await expireStaleListingTransferRequests(client);

  const { data, error } = await client
    .from("listing_transfer_requests")
    .select(
      `id, property_id, from_owner_id, to_owner_id, initiator_user_id, recipient_email, status, created_at, updated_at, responded_at, expires_at, accepted_by_user_id, rejected_by_user_id, cancelled_by_user_id, last_failure_code, last_failure_reason, last_failed_at,
      property:properties(id, title, city, status, listing_intent),
      from_owner:profiles!listing_transfer_requests_from_owner_id_fkey(id, full_name, display_name, business_name, role),
      to_owner:profiles!listing_transfer_requests_to_owner_id_fkey(id, full_name, display_name, business_name, role)`
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message || "Unable to load listing transfer history.");
  }

  return normalizeTransferRequestRecords(data as Record<string, unknown>[] | null);
}

async function resolveTransferRecipient(input: {
  client: SupabaseClient;
  email: string;
  currentOwnerId: string;
}) {
  const authUser = await findAdminAuthUserByEmail(input.client as never, input.email);
  if (!authUser?.id) {
    return { ok: false as const, code: "INVALID_RECIPIENT" as const, error: "Recipient account not found." };
  }

  if (authUser.id === input.currentOwnerId) {
    return { ok: false as const, code: "SELF_TRANSFER" as const, error: "Listing is already owned by this account." };
  }

  const { data: profile, error } = await input.client
    .from("profiles")
    .select("id, role, full_name, display_name, business_name")
    .eq("id", authUser.id)
    .maybeSingle<TransferProfileRow>();

  if (error || !profile) {
    return { ok: false as const, code: "INVALID_RECIPIENT" as const, error: "Recipient profile could not be loaded." };
  }

  if (!profile.role || !LISTING_TRANSFER_RECIPIENT_ROLES.includes(profile.role)) {
    return {
      ok: false as const,
      code: "RECIPIENT_ROLE_INVALID" as const,
      error: "Recipient must be a landlord or agent account.",
    };
  }

  return {
    ok: true as const,
    userId: authUser.id,
    email: authUser.email?.trim() || input.email.trim(),
    profile,
  };
}

export async function createListingTransferRequest(input: {
  propertyId: string;
  initiatorUserId: string;
  recipientEmail: string;
}): Promise<CreateTransferResult> {
  const client = createTransferClient();
  await expireStaleListingTransferRequests(client);

  const { data: property, error: propertyError } = await client
    .from("properties")
    .select("id, owner_id, title, city, status, listing_intent")
    .eq("id", input.propertyId)
    .maybeSingle<TransferPropertyRow>();

  if (propertyError || !property) {
    return { ok: false, code: "LISTING_NOT_FOUND", error: "Listing not found." };
  }

  if (property.owner_id !== input.initiatorUserId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Only the current listing owner can transfer this listing.",
    };
  }

  const { data: existingPending } = await client
    .from("listing_transfer_requests")
    .select("id")
    .eq("property_id", property.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending?.id) {
    return {
      ok: false,
      code: "PENDING_EXISTS",
      error: "This listing already has a pending ownership transfer.",
    };
  }

  const recipient = await resolveTransferRecipient({
    client,
    email: input.recipientEmail,
    currentOwnerId: property.owner_id,
  });
  if (!recipient.ok) {
    return recipient;
  }

  const nowIso = new Date().toISOString();
  const expiresAt = resolveListingTransferExpiresAt(new Date(nowIso));

  const { data: inserted, error: insertError } = await client
    .from("listing_transfer_requests")
    .insert({
      property_id: property.id,
      from_owner_id: property.owner_id,
      to_owner_id: recipient.userId,
      initiator_user_id: input.initiatorUserId,
      recipient_email: recipient.email,
      status: "pending",
      created_at: nowIso,
      updated_at: nowIso,
      expires_at: expiresAt,
      metadata: {
        property_title: property.title ?? null,
        recipient_role: recipient.profile.role ?? null,
      },
    })
    .select(
      `id, property_id, from_owner_id, to_owner_id, initiator_user_id, recipient_email, status, created_at, updated_at, responded_at, expires_at, accepted_by_user_id, rejected_by_user_id, cancelled_by_user_id, last_failure_code, last_failure_reason, last_failed_at,
      property:properties(id, title, city, status, listing_intent),
      from_owner:profiles!listing_transfer_requests_from_owner_id_fkey(id, full_name, display_name, business_name, role),
      to_owner:profiles!listing_transfer_requests_to_owner_id_fkey(id, full_name, display_name, business_name, role)`
    )
    .maybeSingle();

  if (insertError || !inserted) {
    if ((insertError?.message || "").toLowerCase().includes("pending_property")) {
      return {
        ok: false,
        code: "PENDING_EXISTS",
        error: "This listing already has a pending ownership transfer.",
      };
    }
    return {
      ok: false,
      code: "SERVER_ERROR",
      error: insertError?.message || "Unable to create ownership transfer.",
    };
  }

  return { ok: true, request: normalizeTransferRequestRecord(inserted as Record<string, unknown>) };
}

async function cancelOrRejectListingTransfer(input: {
  requestId: string;
  actorUserId: string;
  action: "reject" | "cancel";
}): Promise<RespondTransferResult> {
  const client = createTransferClient();
  await expireStaleListingTransferRequests(client);
  const request = await selectTransferRequestById(client, input.requestId);

  if (!request) {
    return { ok: false, code: "REQUEST_NOT_FOUND", error: "Transfer request not found." };
  }

  if (request.status !== "pending") {
    return { ok: false, code: "REQUEST_NOT_PENDING", error: "Transfer request is no longer pending." };
  }

  const isCancel = input.action === "cancel";
  const allowed = isCancel
    ? request.initiator_user_id === input.actorUserId || request.from_owner_id === input.actorUserId
    : request.to_owner_id === input.actorUserId;

  if (!allowed) {
    return {
      ok: false,
      code: isCancel ? "NOT_INITIATOR" : "NOT_RECIPIENT",
      error: isCancel
        ? "Only the current owner can cancel this transfer request."
        : "Only the transfer recipient can reject this request.",
    };
  }

  const nowIso = new Date().toISOString();
  const updates = isCancel
    ? {
        status: "cancelled",
        responded_at: nowIso,
        cancelled_by_user_id: input.actorUserId,
        updated_at: nowIso,
      }
    : {
        status: "rejected",
        responded_at: nowIso,
        rejected_by_user_id: input.actorUserId,
        updated_at: nowIso,
      };

  const { error } = await client.from("listing_transfer_requests").update(updates).eq("id", request.id);
  if (error) {
    return { ok: false, code: "SERVER_ERROR", error: error.message || "Unable to update transfer request." };
  }

  const updated = await selectTransferRequestById(client, request.id);
  if (!updated) {
    return { ok: false, code: "SERVER_ERROR", error: "Transfer request could not be reloaded." };
  }

  return { ok: true, request: updated };
}

export async function respondToListingTransferRequest(input: {
  requestId: string;
  actorUserId: string;
  action: "accept" | "reject" | "cancel";
}): Promise<RespondTransferResult> {
  if (input.action === "reject" || input.action === "cancel") {
    return cancelOrRejectListingTransfer({
      requestId: input.requestId,
      actorUserId: input.actorUserId,
      action: input.action,
    });
  }

  const client = createTransferClient();
  await expireStaleListingTransferRequests(client);
  const request = await selectTransferRequestById(client, input.requestId);

  if (!request) {
    return { ok: false, code: "REQUEST_NOT_FOUND", error: "Transfer request not found." };
  }

  if (request.status !== "pending") {
    return { ok: false, code: "REQUEST_NOT_PENDING", error: "Transfer request is no longer pending." };
  }

  if (request.to_owner_id !== input.actorUserId) {
    return { ok: false, code: "NOT_RECIPIENT", error: "Only the transfer recipient can accept this request." };
  }

  const propertyStatus = request.property?.status ?? null;
  const entitlementRequired = resolveListingTransferRequiresEntitlement(propertyStatus);
  const recipientRole = request.to_owner?.role ?? null;
  const billingUrl = resolveListingTransferBillingUrl(recipientRole);
  const idempotencyKey = `listing-transfer:${request.id}:accept`;

  if (entitlementRequired && (recipientRole === "agent" || recipientRole === "landlord")) {
    const paygConfig = await getPaygConfig();
    const trialCredits = recipientRole === "agent" ? paygConfig.trialAgentCredits : paygConfig.trialLandlordCredits;
    if (trialCredits > 0) {
      await issueTrialCreditsIfEligible({
        client,
        userId: request.to_owner_id,
        role: recipientRole,
        credits: trialCredits,
      });
    }
  }

  const { data, error } = await client.rpc("complete_listing_ownership_transfer", {
    in_transfer_id: request.id,
    in_accepting_user_id: input.actorUserId,
    in_requires_entitlement: entitlementRequired,
    in_idempotency_key: entitlementRequired ? idempotencyKey : null,
  });

  if (error) {
    return { ok: false, code: "SERVER_ERROR", error: error.message || "Unable to complete ownership transfer." };
  }

  const payload = (data ?? {}) as TransferRpcPayload;
  if (!payload.ok) {
    if (payload.code === "NO_CREDITS") {
      const paygConfig = await getPaygConfig();
      if (!paygConfig.enabled) {
        return {
          ok: false,
          code: "BILLING_REQUIRED",
          error: "You need an active listing plan before accepting this transfer.",
          billingUrl,
          reason: "BILLING_REQUIRED",
        };
      }
      return {
        ok: false,
        code: "PAYMENT_REQUIRED",
        error: "You need listing credits before accepting this transfer.",
        billingUrl,
        reason: "PAYMENT_REQUIRED",
        amount: paygConfig.amount,
        currency: paygConfig.currency,
      };
    }

    return {
      ok: false,
      code: (payload.code as ListingTransferFailureCode) || "INVALID_STATE",
      error: payload.message || "Transfer could not be completed.",
      billingUrl,
    };
  }

  const updated = await selectTransferRequestById(client, request.id);
  if (!updated) {
    return { ok: false, code: "SERVER_ERROR", error: "Transfer request completed but could not be reloaded." };
  }

  return { ok: true, request: updated };
}

export function summarizeListingTransferRequests(input: { incoming: ListingTransferRequestRecord[]; outgoing: ListingTransferRequestRecord[] }) {
  const all = [...input.incoming, ...input.outgoing];
  const pendingIncoming = input.incoming.filter((row) => row.status === "pending").length;
  const pendingOutgoing = input.outgoing.filter((row) => row.status === "pending").length;
  const acceptedCount = all.filter((row) => row.status === "accepted").length;
  return {
    total: all.length,
    pendingIncoming,
    pendingOutgoing,
    acceptedCount,
  };
}

export function describeTransferParty(profile: TransferProfileRow | null | undefined) {
  return formatProfileName(profile) || profile?.id || "Unknown user";
}

export function describeTransferListing(row: ListingTransferRequestRecord) {
  const title = row.property?.title?.trim() || "Untitled listing";
  const city = row.property?.city?.trim();
  return city ? `${title} · ${city}` : title;
}

export function resolveTransferEntitlementLabel(status?: PropertyStatus | null) {
  return resolveListingTransferRequiresEntitlement(status)
    ? "Recipient entitlement required before acceptance"
    : `No fresh entitlement required for ${LISTING_TRANSFER_EXPIRY_DAYS}-day transfer window`;
}
