import type { SupabaseClient } from "@supabase/supabase-js";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { CONTACT_EXCHANGE_BLOCK_CODE, CONTACT_EXCHANGE_BLOCK_MESSAGE, sanitizeMessageContent } from "@/lib/messaging/contact-exchange";
import { isListingPubliclyVisible } from "@/lib/properties/expiry";
import { getContactExchangeMode } from "@/lib/settings/app-settings.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import type { UserRole } from "@/lib/types";
import {
  PROPERTY_REQUEST_RESPONSE_MAX_LISTINGS,
  canRoleRespondToPropertyRequests,
  canSendPropertyRequestResponses,
  doesListingIntentMatchPropertyRequest,
  isPropertyRequestOpenForResponses,
  mapPropertyRequestResponseRecord,
  type PropertyRequest,
  type PropertyRequestResponderBoardState,
  type PropertyRequestResponse,
  type PropertyRequestResponseCreateInput,
  type PropertyRequestResponseItemRecord,
  type PropertyRequestResponseListing,
  type PropertyRequestResponseRecord,
  type PropertyRequestResponderRole,
} from "@/lib/requests/property-requests";

type AuthenticatedSupabase = SupabaseClient;

type ManagedListingRow = {
  id: string;
  owner_id: string;
  title: string;
  city: string | null;
  neighbourhood: string | null;
  price: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  rental_type: string | null;
  rent_period: string | null;
  listing_intent: string | null;
  listing_type: string | null;
  cover_image_url: string | null;
  status: string | null;
  is_approved: boolean | null;
  is_active: boolean | null;
  expires_at: string | null;
  updated_at?: string | null;
};

type CreateResponseResult =
  | { ok: true; responseId: string }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
      issues?: Record<string, unknown>;
      missingListingIds?: string[];
      duplicateListingIds?: string[];
    };

const RESPONSE_SELECT_COLUMNS = [
  "id",
  "request_id",
  "responder_user_id",
  "responder_role",
  "message",
  "created_at",
  "updated_at",
].join(", ");

const RESPONSE_ITEM_SELECT_COLUMNS = ["id", "response_id", "listing_id", "position", "created_at"].join(", ");

const RESPONSE_LISTING_SELECT_COLUMNS = [
  "id",
  "owner_id",
  "title",
  "city",
  "neighbourhood",
  "price",
  "currency",
  "bedrooms",
  "bathrooms",
  "rental_type",
  "rent_period",
  "listing_intent",
  "listing_type",
  "cover_image_url",
  "status",
  "is_approved",
  "is_active",
  "expires_at",
  "updated_at",
].join(", ");

function getDataClient(supabase: AuthenticatedSupabase): UntypedAdminClient {
  return hasServiceRoleEnv()
    ? (createServiceRoleClient() as unknown as UntypedAdminClient)
    : (supabase as unknown as UntypedAdminClient);
}

function mapManagedListingRow(row: ManagedListingRow): PropertyRequestResponseListing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    city: row.city,
    neighbourhood: row.neighbourhood,
    price: row.price,
    currency: row.currency,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    rentalType: row.rental_type,
    rentPeriod: row.rent_period,
    listingIntent: row.listing_intent,
    listingType: row.listing_type,
    coverImageUrl: row.cover_image_url,
    status: row.status,
    isApproved: row.is_approved,
    isActive: row.is_active,
    expiresAt: row.expires_at,
  };
}

async function listAgentDelegatedOwnerIds(input: {
  supabase: AuthenticatedSupabase;
  userId: string;
}): Promise<string[]> {
  const dataClient = getDataClient(input.supabase);
  const { data, error } = await dataClient
    .from<{ landlord_id: string }>("agent_delegations")
    .select("landlord_id")
    .eq("agent_id", input.userId)
    .eq("status", "active");

  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => row.landlord_id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

async function resolveManagedOwnerIds(input: {
  supabase: AuthenticatedSupabase;
  role: PropertyRequestResponderRole;
  userId: string;
}): Promise<string[]> {
  if (input.role === "landlord") {
    return [input.userId];
  }

  const delegated = await listAgentDelegatedOwnerIds({
    supabase: input.supabase,
    userId: input.userId,
  });
  return Array.from(new Set([input.userId, ...delegated]));
}

export async function listManagedResponseListings(input: {
  supabase: AuthenticatedSupabase;
  role: UserRole;
  userId: string;
  request: PropertyRequest;
  now?: Date;
}): Promise<PropertyRequestResponseListing[]> {
  if (!canRoleRespondToPropertyRequests(input.role)) {
    return [];
  }

  const ownerIds = await resolveManagedOwnerIds({
    supabase: input.supabase,
    role: input.role,
    userId: input.userId,
  });
  if (ownerIds.length === 0) return [];

  const dataClient = getDataClient(input.supabase);
  let query = dataClient
    .from<ManagedListingRow>("properties")
    .select(RESPONSE_LISTING_SELECT_COLUMNS)
    .eq("status", "live")
    .eq("is_active", true)
    .eq("is_approved", true)
    .order("updated_at", { ascending: false });

  if (ownerIds.length === 1) {
    query = query.eq("owner_id", ownerIds[0]);
  } else {
    query = query.in("owner_id", ownerIds);
  }

  const { data } = await query;
  const now = input.now ?? new Date();

  return ((data ?? []) as ManagedListingRow[])
    .filter((listing) => isListingPubliclyVisible(listing, now))
    .filter((listing) => doesListingIntentMatchPropertyRequest(listing.listing_intent, input.request.intent))
    .map(mapManagedListingRow);
}

export async function listVisiblePropertyRequestResponses(input: {
  supabase: AuthenticatedSupabase;
  role: UserRole;
  userId: string;
  requestId: string;
}): Promise<PropertyRequestResponse[]> {
  const authDataClient = input.supabase as unknown as UntypedAdminClient;
  let query = authDataClient
    .from<PropertyRequestResponseRecord>("property_request_responses")
    .select(RESPONSE_SELECT_COLUMNS)
    .eq("request_id", input.requestId)
    .order("created_at", { ascending: false });

  if (input.role === "landlord" || input.role === "agent") {
    query = query.eq("responder_user_id", input.userId);
  }

  const { data } = await query;
  const responses = (data ?? []) as PropertyRequestResponseRecord[];
  if (responses.length === 0) return [];

  const responseIds = responses.map((response) => response.id);
  const { data: itemRows } = await authDataClient
    .from<PropertyRequestResponseItemRecord>("property_request_response_items")
    .select(RESPONSE_ITEM_SELECT_COLUMNS)
    .in("response_id", responseIds)
    .order("position", { ascending: true });

  const items = (itemRows ?? []) as PropertyRequestResponseItemRecord[];
  const listingIds = Array.from(new Set(items.map((item) => item.listing_id)));
  const dataClient = getDataClient(input.supabase);
  const { data: listingRows } = listingIds.length
    ? await dataClient
        .from<ManagedListingRow>("properties")
        .select(RESPONSE_LISTING_SELECT_COLUMNS)
        .in("id", listingIds)
    : { data: [] as ManagedListingRow[] };

  const listingsById = new Map(
    ((listingRows ?? []) as ManagedListingRow[]).map((listing) => [listing.id, mapManagedListingRow(listing)])
  );
  const itemsByResponseId = new Map<string, PropertyRequestResponseListing[]>();
  for (const item of items) {
    const listing = listingsById.get(item.listing_id);
    if (!listing) continue;
    const current = itemsByResponseId.get(item.response_id) ?? [];
    current.push(listing);
    itemsByResponseId.set(item.response_id, current);
  }

  return responses.map((response) =>
    mapPropertyRequestResponseRecord(response, itemsByResponseId.get(response.id) ?? [])
  );
}

export async function listPropertyRequestResponderBoardStates(input: {
  supabase: AuthenticatedSupabase;
  role: UserRole;
  userId: string;
  requestIds: string[];
}): Promise<Map<string, PropertyRequestResponderBoardState>> {
  if (!canRoleRespondToPropertyRequests(input.role) || input.requestIds.length === 0) {
    return new Map();
  }

  const requestIds = Array.from(new Set(input.requestIds));
  const authDataClient = input.supabase as unknown as UntypedAdminClient;
  const { data } = await authDataClient
    .from<Pick<PropertyRequestResponseRecord, "id" | "request_id">>("property_request_responses")
    .select("id, request_id")
    .eq("responder_user_id", input.userId)
    .in("request_id", requestIds);

  const responses = (data ?? []) as Array<Pick<PropertyRequestResponseRecord, "id" | "request_id">>;
  if (responses.length === 0) {
    return new Map();
  }

  const responseIds = responses.map((response) => response.id);
  const { data: itemRows } = await authDataClient
    .from<Pick<PropertyRequestResponseItemRecord, "response_id">>("property_request_response_items")
    .select("response_id")
    .in("response_id", responseIds);

  const listingCountsByResponseId = new Map<string, number>();
  for (const item of (itemRows ?? []) as Array<Pick<PropertyRequestResponseItemRecord, "response_id">>) {
    listingCountsByResponseId.set(
      item.response_id,
      (listingCountsByResponseId.get(item.response_id) ?? 0) + 1
    );
  }

  const boardStates = new Map<string, PropertyRequestResponderBoardState>();
  for (const response of responses) {
    const current = boardStates.get(response.request_id) ?? {
      hasResponded: true,
      respondedListingCount: 0,
    };
    current.respondedListingCount += listingCountsByResponseId.get(response.id) ?? 0;
    boardStates.set(response.request_id, current);
  }

  return boardStates;
}

async function resolveResponderEligibleListings(input: {
  supabase: AuthenticatedSupabase;
  role: PropertyRequestResponderRole;
  userId: string;
  request: PropertyRequest;
  listingIds: string[];
  now: Date;
}): Promise<PropertyRequestResponseListing[]> {
  const managedListings = await listManagedResponseListings({
    supabase: input.supabase,
    role: input.role,
    userId: input.userId,
    request: input.request,
    now: input.now,
  });
  const listingMap = new Map(managedListings.map((listing) => [listing.id, listing]));
  return input.listingIds
    .map((listingId) => listingMap.get(listingId) ?? null)
    .filter((listing): listing is PropertyRequestResponseListing => listing !== null);
}

async function findResponderDuplicateListingIds(input: {
  supabase: AuthenticatedSupabase;
  requestId: string;
  responderUserId: string;
  listingIds: string[];
}): Promise<string[]> {
  const dataClient = getDataClient(input.supabase);
  const { data: responseRows } = await dataClient
    .from<PropertyRequestResponseRecord>("property_request_responses")
    .select("id")
    .eq("request_id", input.requestId)
    .eq("responder_user_id", input.responderUserId);

  const responseIds = ((responseRows ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (responseIds.length === 0) return [];

  const { data: itemRows } = await dataClient
    .from<PropertyRequestResponseItemRecord>("property_request_response_items")
    .select("listing_id")
    .in("response_id", responseIds)
    .in("listing_id", input.listingIds);

  return Array.from(
    new Set(
      ((itemRows ?? []) as Array<{ listing_id: string }>).map((row) => row.listing_id)
    )
  );
}

export async function createPropertyRequestResponse(input: {
  supabase: AuthenticatedSupabase;
  role: UserRole;
  userId: string;
  request: PropertyRequest;
  payload: PropertyRequestResponseCreateInput;
  now?: Date;
}): Promise<CreateResponseResult> {
  const now = input.now ?? new Date();
  if (!canRoleRespondToPropertyRequests(input.role)) {
    return { ok: false, status: 403, error: "Only hosts and agents can send matches." };
  }
  if (
    !canSendPropertyRequestResponses({
      role: input.role,
      viewerUserId: input.userId,
      request: input.request,
      now,
    })
  ) {
    return { ok: false, status: 409, error: "This request is not accepting responses." };
  }
  if (!isPropertyRequestOpenForResponses(input.request)) {
    return { ok: false, status: 409, error: "This request is no longer open for responses." };
  }

  const eligibleListings = await resolveResponderEligibleListings({
    supabase: input.supabase,
    role: input.role,
    userId: input.userId,
    request: input.request,
    listingIds: input.payload.listingIds,
    now,
  });

  const eligibleListingIds = new Set(eligibleListings.map((listing) => listing.id));
  const missingListingIds = input.payload.listingIds.filter((listingId) => !eligibleListingIds.has(listingId));
  if (missingListingIds.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "One or more listings are not eligible for this response.",
      missingListingIds,
    };
  }

  const duplicateListingIds = await findResponderDuplicateListingIds({
    supabase: input.supabase,
    requestId: input.request.id,
    responderUserId: input.userId,
    listingIds: input.payload.listingIds,
  });
  if (duplicateListingIds.length > 0) {
    return {
      ok: false,
      status: 409,
      error: "You have already sent one or more of these listings to this request.",
      duplicateListingIds,
    };
  }

  let sanitizedMessage = input.payload.message?.trim() || null;
  if (sanitizedMessage) {
    const contactMode = await getContactExchangeMode(input.supabase);
    const sanitized = sanitizeMessageContent(sanitizedMessage, contactMode);
    if (sanitized.action === "block") {
      return {
        ok: false,
        status: 400,
        error: CONTACT_EXCHANGE_BLOCK_MESSAGE,
        code: CONTACT_EXCHANGE_BLOCK_CODE,
      };
    }
    sanitizedMessage = sanitized.text;
  }

  const writeClient = getDataClient(input.supabase);
  const { data: insertedResponse, error: insertError } = await writeClient
    .from<PropertyRequestResponseRecord>("property_request_responses")
    .insert({
      request_id: input.request.id,
      responder_user_id: input.userId,
      responder_role: input.role,
      message: sanitizedMessage,
    })
    .select(RESPONSE_SELECT_COLUMNS)
    .maybeSingle();

  if (insertError || !insertedResponse) {
    return { ok: false, status: 500, error: "Unable to send matching listings." };
  }

  const itemPayload = input.payload.listingIds.slice(0, PROPERTY_REQUEST_RESPONSE_MAX_LISTINGS).map((listingId, index) => ({
    response_id: insertedResponse.id,
    listing_id: listingId,
    position: index,
  }));

  const { error: itemError } = await writeClient
    .from("property_request_response_items")
    .insert(itemPayload);

  if (itemError) {
    await writeClient.from("property_request_responses").delete().eq("id", insertedResponse.id);
    return { ok: false, status: 500, error: "Unable to send matching listings." };
  }

  return { ok: true, responseId: insertedResponse.id };
}

export async function canAgentManageListingOwner(input: {
  supabase: AuthenticatedSupabase;
  agentId: string;
  ownerId: string;
}): Promise<boolean> {
  if (input.agentId === input.ownerId) return true;
  return hasActiveDelegation(input.supabase, input.agentId, input.ownerId);
}
