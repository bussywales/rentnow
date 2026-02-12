import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Property } from "@/lib/types";
import { getSiteUrl } from "@/lib/env";
import { orderImagesWithCover } from "@/lib/properties/images";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";
import { buildCollectionWhatsAppShareUrl } from "@/lib/saved-collections/share";

type PropertyImageRow = {
  id: string;
  image_url: string;
  position?: number | null;
  created_at?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
};

type PropertyRow = Property & { property_images?: PropertyImageRow[] | null };

type SavedCollectionItemRow = {
  collection_id: string;
  listing_id: string;
  created_at: string;
};

export type SavedCollectionRow = {
  id: string;
  owner_user_id: string;
  title: string;
  share_id: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type SavedCollectionSummary = {
  id: string;
  title: string;
  count: number;
  isDefault: boolean;
  shareId: string | null;
  shareUrl: string | null;
  containsListing: boolean;
  coverImageUrl: string | null;
  coverTitle: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedCollectionWithListings = {
  collection: SavedCollectionSummary;
  properties: Property[];
};

const PROPERTY_CARD_SELECT = [
  "id",
  "owner_id",
  "title",
  "description",
  "city",
  "country",
  "country_code",
  "state_region",
  "neighbourhood",
  "address",
  "latitude",
  "longitude",
  "listing_type",
  "rental_type",
  "listing_intent",
  "price",
  "currency",
  "rent_period",
  "bedrooms",
  "bathrooms",
  "bathroom_type",
  "furnished",
  "size_value",
  "size_unit",
  "year_built",
  "deposit_amount",
  "deposit_currency",
  "pets_allowed",
  "amenities",
  "available_from",
  "max_guests",
  "is_approved",
  "is_active",
  "status",
  "created_at",
  "updated_at",
  "cover_image_url",
  "is_featured",
  "featured_rank",
  "featured_until",
  "featured_at",
  "featured_by",
  "is_demo",
  "property_images(image_url,id,position,created_at,width,height,bytes,format)",
].join(",");

function mapPropertyRow(property: PropertyRow | null | undefined): Property | null {
  if (!property?.id) return null;
  const images = (property.property_images || []).map((img) => ({
    id: img.id || img.image_url,
    image_url: img.image_url,
    position: img.position ?? null,
    created_at: img.created_at ?? undefined,
    width: img.width ?? null,
    height: img.height ?? null,
    bytes: img.bytes ?? null,
    format: img.format ?? null,
  }));
  return {
    ...property,
    images: orderImagesWithCover(property.cover_image_url, images),
  };
}

function normalizeShareId(input: string | null | undefined) {
  const value = String(input || "").trim();
  return value || null;
}

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "23505" || String(error.message || "").toLowerCase().includes("duplicate");
}

export function normalizeCollectionTitle(input: unknown) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

export function buildCollectionShareUrl(shareId: string | null, siteUrl: string) {
  const normalized = normalizeShareId(shareId);
  if (!normalized) return null;
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/collections/${encodeURIComponent(normalized)}`;
}

export function buildWhatsappShareUrl(shareUrl: string) {
  return buildCollectionWhatsAppShareUrl({ shareUrl });
}

export function isPubliclyVisibleCollectionListing(input: {
  listing: Property;
  now?: Date;
  includeDemo?: boolean;
}) {
  const listing = input.listing;
  if (listing.is_approved !== true) return false;
  if (listing.is_active !== true) return false;
  if (listing.status !== "live") return false;
  if (!input.includeDemo && listing.is_demo) return false;

  const expiresAt = listing.expires_at ? Date.parse(listing.expires_at) : null;
  if (Number.isFinite(expiresAt) && expiresAt !== null) {
    const nowMs = (input.now ?? new Date()).getTime();
    if (expiresAt < nowMs) return false;
  }
  return true;
}

export function uniqueSortedListingIds(listingIds: string[]) {
  return Array.from(new Set(listingIds.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function buildImportedCollectionTitle(collectionTitle: string | null | undefined) {
  const base = normalizeCollectionTitle(
    collectionTitle && collectionTitle.trim() ? `Shortlist from ${collectionTitle}` : "Shared shortlist"
  );
  return base || "Shared shortlist";
}

function listingIdSetsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export type ImportedCollectionCandidate = {
  collectionId: string;
  listingIds: string[];
};

export function findImportedCollectionIdMatch(input: {
  targetListingIds: string[];
  candidates: ImportedCollectionCandidate[];
}) {
  for (const candidate of input.candidates) {
    if (listingIdSetsEqual(candidate.listingIds, input.targetListingIds)) {
      return candidate.collectionId;
    }
  }
  return null;
}

async function getListingIdsByCollectionId(input: {
  supabase: SupabaseClient;
  collectionId: string;
}) {
  const { data, error } = await input.supabase
    .from("saved_collection_items")
    .select("listing_id")
    .eq("collection_id", input.collectionId);
  if (error) throw new Error(error.message);
  const listingIds = ((data as Array<{ listing_id?: string }> | null) ?? [])
    .map((row) => (typeof row.listing_id === "string" ? row.listing_id : ""))
    .filter(Boolean);
  return uniqueSortedListingIds(listingIds);
}

async function findImportedCollectionForOwner(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  title: string;
  targetListingIds: string[];
}) {
  const { data, error } = await input.supabase
    .from("saved_collections")
    .select("id, owner_user_id, title, share_id, is_default, created_at, updated_at")
    .eq("owner_user_id", input.ownerUserId)
    .eq("title", input.title)
    .eq("is_default", false)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  const candidates = (data as unknown as SavedCollectionRow[] | null) ?? [];
  const candidatesWithListingIds: ImportedCollectionCandidate[] = [];
  for (const collection of candidates) {
    const listingIds = await getListingIdsByCollectionId({
      supabase: input.supabase,
      collectionId: collection.id,
    });
    candidatesWithListingIds.push({
      collectionId: collection.id,
      listingIds,
    });
  }
  const matchingId = findImportedCollectionIdMatch({
    targetListingIds: input.targetListingIds,
    candidates: candidatesWithListingIds,
  });
  if (!matchingId) return null;
  return candidates.find((collection) => collection.id === matchingId) ?? null;
}

export async function importSharedCollectionForOwner(input: {
  ownerSupabase: SupabaseClient;
  publicSupabase: SupabaseClient;
  ownerUserId: string;
  shareId: string;
}) {
  const sharedCollection = await getPublicCollectionByShareId({
    supabase: input.publicSupabase,
    shareId: input.shareId,
  });
  if (!sharedCollection) {
    throw new Error("Shared collection not found.");
  }

  const includeDemo = includeDemoListingsForViewer({ viewerRole: null });
  const publicListingIds = uniqueSortedListingIds(
    sharedCollection.properties
      .filter((listing) =>
        isPubliclyVisibleCollectionListing({
          listing,
          includeDemo,
        })
      )
      .map((listing) => listing.id)
  );

  if (!publicListingIds.length) {
    throw new Error("No publicly visible listings are available in this shortlist.");
  }

  const title = buildImportedCollectionTitle(sharedCollection.title);
  let targetCollection = await findImportedCollectionForOwner({
    supabase: input.ownerSupabase,
    ownerUserId: input.ownerUserId,
    title,
    targetListingIds: publicListingIds,
  });

  if (!targetCollection) {
    targetCollection = await createCollectionForOwner({
      supabase: input.ownerSupabase,
      ownerUserId: input.ownerUserId,
      title,
    });
  }

  const rows = publicListingIds.map((listingId) => ({
    collection_id: targetCollection.id,
    listing_id: listingId,
  }));

  const { error: insertError } = await input.ownerSupabase
    .from("saved_collection_items")
    .upsert(rows, { onConflict: "collection_id,listing_id" });

  if (insertError) throw new Error(insertError.message);

  const collections = await listCollectionsForOwner({
    supabase: input.ownerSupabase,
    ownerUserId: input.ownerUserId,
  });
  const summary = collections.find((collection) => collection.id === targetCollection?.id) ?? null;

  return {
    shareTitle: sharedCollection.title,
    collectionId: targetCollection.id,
    collection: summary,
    importedListingIds: publicListingIds,
  };
}

export async function ensureDefaultCollection(input: {
  supabase: SupabaseClient;
  userId: string;
  title?: string;
}) {
  const title = normalizeCollectionTitle(input.title ?? "Favourites") || "Favourites";
  const baseQuery = input.supabase
    .from("saved_collections")
    .select("id, owner_user_id, title, share_id, is_default, created_at, updated_at")
    .eq("owner_user_id", input.userId)
    .eq("is_default", true);

  const { data: existing, error: existingError } = await baseQuery.maybeSingle<SavedCollectionRow>();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing;

  const now = new Date().toISOString();
  const { data: created, error: insertError } = await input.supabase
    .from("saved_collections")
    .insert({
      owner_user_id: input.userId,
      title,
      is_default: true,
      created_at: now,
      updated_at: now,
    })
    .select("id, owner_user_id, title, share_id, is_default, created_at, updated_at")
    .maybeSingle<SavedCollectionRow>();

  if (!insertError && created) return created;
  if (!isUniqueViolation(insertError)) {
    throw new Error(insertError?.message || "Unable to create default collection.");
  }

  const { data: fallback, error: fallbackError } = await baseQuery.maybeSingle<SavedCollectionRow>();
  if (fallbackError || !fallback) {
    throw new Error(fallbackError?.message || "Unable to load default collection.");
  }
  return fallback;
}

export async function listCollectionsForOwner(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  listingId?: string | null;
}): Promise<SavedCollectionSummary[]> {
  const { data: collectionsData, error: collectionsError } = await input.supabase
    .from("saved_collections")
    .select("id, owner_user_id, title, share_id, is_default, created_at, updated_at")
    .eq("owner_user_id", input.ownerUserId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (collectionsError) throw new Error(collectionsError.message);
  const collections = (collectionsData as unknown as SavedCollectionRow[] | null) ?? [];
  if (!collections.length) return [];

  const collectionIds = collections.map((collection) => collection.id);
  const { data: itemsData, error: itemsError } = await input.supabase
    .from("saved_collection_items")
    .select("collection_id, listing_id, created_at")
    .in("collection_id", collectionIds)
    .order("created_at", { ascending: false });

  if (itemsError) throw new Error(itemsError.message);
  const items = (itemsData as unknown as SavedCollectionItemRow[] | null) ?? [];

  const counts = new Map<string, number>();
  const containsListing = new Map<string, boolean>();
  const coverListingByCollection = new Map<string, string>();

  for (const item of items) {
    counts.set(item.collection_id, (counts.get(item.collection_id) ?? 0) + 1);
    if (input.listingId && item.listing_id === input.listingId) {
      containsListing.set(item.collection_id, true);
    }
    if (!coverListingByCollection.has(item.collection_id)) {
      coverListingByCollection.set(item.collection_id, item.listing_id);
    }
  }

  const coverListingIds = Array.from(new Set(coverListingByCollection.values()));
  const covers = new Map<string, { title: string | null; imageUrl: string | null }>();
  if (coverListingIds.length > 0) {
    const { data: coverRows, error: coverError } = await input.supabase
      .from("properties")
      .select("id,title,cover_image_url,property_images(image_url,id,position,created_at)")
      .in("id", coverListingIds);
    if (coverError) throw new Error(coverError.message);
    for (const row of ((coverRows as unknown as PropertyRow[] | null) ?? [])) {
      const property = mapPropertyRow(row);
      if (!property) continue;
      covers.set(property.id, {
        title: property.title ?? null,
        imageUrl: property.cover_image_url || property.images?.[0]?.image_url || null,
      });
    }
  }

  const siteUrl = await getSiteUrl();
  return collections.map((collection) => {
    const coverListingId = coverListingByCollection.get(collection.id) ?? null;
    const cover = coverListingId ? covers.get(coverListingId) : null;
    return {
      id: collection.id,
      title: collection.title,
      count: counts.get(collection.id) ?? 0,
      isDefault: collection.is_default,
      shareId: normalizeShareId(collection.share_id),
      shareUrl: buildCollectionShareUrl(collection.share_id, siteUrl),
      containsListing: containsListing.get(collection.id) ?? false,
      coverImageUrl: cover?.imageUrl ?? null,
      coverTitle: cover?.title ?? null,
      createdAt: collection.created_at,
      updatedAt: collection.updated_at,
    };
  });
}

async function getPropertiesByIds(input: {
  supabase: SupabaseClient;
  listingIds: string[];
}): Promise<Map<string, Property>> {
  if (!input.listingIds.length) return new Map();
  const { data, error } = await input.supabase
    .from("properties")
    .select(PROPERTY_CARD_SELECT)
    .in("id", input.listingIds);

  if (error) throw new Error(error.message);
  const map = new Map<string, Property>();
  for (const row of ((data as unknown as PropertyRow[] | null) ?? [])) {
    const property = mapPropertyRow(row);
    if (!property) continue;
    map.set(property.id, property);
  }
  return map;
}

async function getCollectionRowForOwner(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  collectionId: string;
}) {
  const { data, error } = await input.supabase
    .from("saved_collections")
    .select("id, owner_user_id, title, share_id, is_default, created_at, updated_at")
    .eq("id", input.collectionId)
    .eq("owner_user_id", input.ownerUserId)
    .maybeSingle<SavedCollectionRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getCollectionWithListingsForOwner(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  collectionId: string;
}): Promise<SavedCollectionWithListings | null> {
  const collection = await getCollectionRowForOwner(input);
  if (!collection) return null;

  const { data: itemRows, error: itemsError } = await input.supabase
    .from("saved_collection_items")
    .select("collection_id, listing_id, created_at")
    .eq("collection_id", input.collectionId)
    .order("created_at", { ascending: false });

  if (itemsError) throw new Error(itemsError.message);
  const items = (itemRows as unknown as SavedCollectionItemRow[] | null) ?? [];
  const orderedListingIds = items.map((item) => item.listing_id);
  const uniqueListingIds = Array.from(new Set(orderedListingIds));
  const propertiesById = await getPropertiesByIds({
    supabase: input.supabase,
    listingIds: uniqueListingIds,
  });

  const properties = orderedListingIds
    .map((listingId) => propertiesById.get(listingId))
    .filter((property): property is Property => !!property);

  const siteUrl = await getSiteUrl();
  return {
    collection: {
      id: collection.id,
      title: collection.title,
      count: properties.length,
      isDefault: collection.is_default,
      shareId: normalizeShareId(collection.share_id),
      shareUrl: buildCollectionShareUrl(collection.share_id, siteUrl),
      containsListing: false,
      coverImageUrl: properties[0]?.cover_image_url || properties[0]?.images?.[0]?.image_url || null,
      coverTitle: properties[0]?.title || null,
      createdAt: collection.created_at,
      updatedAt: collection.updated_at,
    },
    properties,
  };
}

export async function getPublicCollectionByShareId(input: {
  supabase: SupabaseClient;
  shareId: string;
}): Promise<{ title: string; properties: Property[] } | null> {
  const { data: collection, error: collectionError } = await input.supabase
    .from("saved_collections")
    .select("id,title")
    .eq("share_id", input.shareId)
    .maybeSingle<{ id: string; title: string }>();

  if (collectionError) throw new Error(collectionError.message);
  if (!collection) return null;

  const { data: itemRows, error: itemsError } = await input.supabase
    .from("saved_collection_items")
    .select("listing_id, created_at")
    .eq("collection_id", collection.id)
    .order("created_at", { ascending: false });

  if (itemsError) throw new Error(itemsError.message);
  const orderedListingIds = ((itemRows as unknown as Array<{ listing_id: string }> | null) ?? []).map(
    (row) => row.listing_id
  );
  const uniqueListingIds = Array.from(new Set(orderedListingIds));
  const propertiesById = await getPropertiesByIds({
    supabase: input.supabase,
    listingIds: uniqueListingIds,
  });

  const properties = orderedListingIds
    .map((listingId) => propertiesById.get(listingId))
    .filter((property): property is Property => !!property);

  return {
    title: collection.title,
    properties,
  };
}

export async function getPublicCollectionShareMetaByShareId(input: {
  supabase: SupabaseClient;
  shareId: string;
}): Promise<{ title: string; city: string | null; imageUrl: string | null } | null> {
  const { data: collection, error: collectionError } = await input.supabase
    .from("saved_collections")
    .select("id,title")
    .eq("share_id", input.shareId)
    .maybeSingle<{ id: string; title: string }>();

  if (collectionError) throw new Error(collectionError.message);
  if (!collection) return null;

  const { data: firstItem, error: firstItemError } = await input.supabase
    .from("saved_collection_items")
    .select("listing_id")
    .eq("collection_id", collection.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ listing_id: string }>();

  if (firstItemError) throw new Error(firstItemError.message);
  if (!firstItem?.listing_id) {
    return {
      title: collection.title,
      city: null,
      imageUrl: null,
    };
  }

  const { data: listingRow, error: listingError } = await input.supabase
    .from("properties")
    .select("city,cover_image_url,property_images(image_url,id,created_at)")
    .eq("id", firstItem.listing_id)
    .order("created_at", { foreignTable: "property_images", ascending: true })
    .maybeSingle<{
      city?: string | null;
      cover_image_url?: string | null;
      property_images?: Array<{ image_url: string; id?: string | null; created_at?: string | null }>;
    }>();

  if (listingError) throw new Error(listingError.message);

  return {
    title: collection.title,
    city: listingRow?.city?.trim() || null,
    imageUrl:
      listingRow?.cover_image_url ||
      listingRow?.property_images?.[0]?.image_url ||
      null,
  };
}

async function ensureListingExists(input: { supabase: SupabaseClient; listingId: string }) {
  const { data, error } = await input.supabase
    .from("properties")
    .select("id")
    .eq("id", input.listingId)
    .maybeSingle<{ id: string }>();
  if (error) throw new Error("Invalid listing id.");
  if (!data) throw new Error("Listing not found.");
}

export async function createCollectionForOwner(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  title: string;
}) {
  const title = normalizeCollectionTitle(input.title);
  if (!title) {
    throw new Error("Collection title is required.");
  }

  const now = new Date().toISOString();
  const { data, error } = await input.supabase
    .from("saved_collections")
    .insert({
      owner_user_id: input.ownerUserId,
      title,
      is_default: false,
      created_at: now,
      updated_at: now,
    })
    .select("id, owner_user_id, title, share_id, is_default, created_at, updated_at")
    .maybeSingle<SavedCollectionRow>();

  if (error || !data) throw new Error(error?.message || "Unable to create collection.");
  return data;
}

export async function updateCollectionForOwner(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  collectionId: string;
  title?: string;
  shareEnabled?: boolean;
}) {
  const existing = await getCollectionRowForOwner({
    supabase: input.supabase,
    ownerUserId: input.ownerUserId,
    collectionId: input.collectionId,
  });
  if (!existing) return null;

  const patch: Record<string, unknown> = {};
  if (typeof input.title === "string") {
    const normalizedTitle = normalizeCollectionTitle(input.title);
    if (!normalizedTitle) throw new Error("Collection title is required.");
    patch.title = normalizedTitle;
  }
  if (typeof input.shareEnabled === "boolean") {
    patch.share_id = input.shareEnabled ? normalizeShareId(existing.share_id) || randomUUID() : null;
  }

  if (!Object.keys(patch).length) return existing;

  const { data, error } = await input.supabase
    .from("saved_collections")
    .update(patch)
    .eq("id", input.collectionId)
    .eq("owner_user_id", input.ownerUserId)
    .select("id, owner_user_id, title, share_id, is_default, created_at, updated_at")
    .maybeSingle<SavedCollectionRow>();

  if (error || !data) throw new Error(error?.message || "Unable to update collection.");
  return data;
}

export async function deleteCollectionForOwner(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  collectionId: string;
}) {
  const { data, error } = await input.supabase
    .from("saved_collections")
    .delete()
    .eq("id", input.collectionId)
    .eq("owner_user_id", input.ownerUserId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function upsertListingInCollectionForOwner(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  collectionId: string;
  listingId: string;
}) {
  const collection = await getCollectionRowForOwner({
    supabase: input.supabase,
    ownerUserId: input.ownerUserId,
    collectionId: input.collectionId,
  });
  if (!collection) return { ok: false as const, reason: "not_found" as const };

  await ensureListingExists({ supabase: input.supabase, listingId: input.listingId });
  const { error } = await input.supabase.from("saved_collection_items").upsert(
    {
      collection_id: input.collectionId,
      listing_id: input.listingId,
    },
    { onConflict: "collection_id,listing_id" }
  );
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function removeListingFromCollectionForOwner(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  collectionId: string;
  listingId: string;
}) {
  const collection = await getCollectionRowForOwner({
    supabase: input.supabase,
    ownerUserId: input.ownerUserId,
    collectionId: input.collectionId,
  });
  if (!collection) return { ok: false as const, reason: "not_found" as const };

  const { error } = await input.supabase
    .from("saved_collection_items")
    .delete()
    .eq("collection_id", input.collectionId)
    .eq("listing_id", input.listingId);

  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function toggleListingInDefaultCollection(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  listingId: string;
}) {
  await ensureListingExists({ supabase: input.supabase, listingId: input.listingId });
  const collection = await ensureDefaultCollection({
    supabase: input.supabase,
    userId: input.ownerUserId,
  });

  const { data: existing, error: existingError } = await input.supabase
    .from("saved_collection_items")
    .select("collection_id")
    .eq("collection_id", collection.id)
    .eq("listing_id", input.listingId)
    .maybeSingle<{ collection_id: string }>();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { error: deleteError } = await input.supabase
      .from("saved_collection_items")
      .delete()
      .eq("collection_id", collection.id)
      .eq("listing_id", input.listingId);
    if (deleteError) throw new Error(deleteError.message);
    return { saved: false, collectionId: collection.id };
  }

  const { error: insertError } = await input.supabase.from("saved_collection_items").insert({
    collection_id: collection.id,
    listing_id: input.listingId,
  });
  if (insertError) throw new Error(insertError.message);
  return { saved: true, collectionId: collection.id };
}

export async function setListingInDefaultCollection(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  listingId: string;
  desiredSaved: boolean;
}) {
  await ensureListingExists({ supabase: input.supabase, listingId: input.listingId });
  const collection = await ensureDefaultCollection({
    supabase: input.supabase,
    userId: input.ownerUserId,
  });

  const { data: existing, error: existingError } = await input.supabase
    .from("saved_collection_items")
    .select("collection_id")
    .eq("collection_id", collection.id)
    .eq("listing_id", input.listingId)
    .maybeSingle<{ collection_id: string }>();
  if (existingError) throw new Error(existingError.message);

  if (input.desiredSaved && !existing) {
    const { error: insertError } = await input.supabase.from("saved_collection_items").insert({
      collection_id: collection.id,
      listing_id: input.listingId,
    });
    if (insertError) throw new Error(insertError.message);
    return { saved: true, collectionId: collection.id };
  }

  if (!input.desiredSaved && existing) {
    const { error: deleteError } = await input.supabase
      .from("saved_collection_items")
      .delete()
      .eq("collection_id", collection.id)
      .eq("listing_id", input.listingId);
    if (deleteError) throw new Error(deleteError.message);
    return { saved: false, collectionId: collection.id };
  }

  return { saved: !!existing, collectionId: collection.id };
}
