import type { Property } from "@/lib/types";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { orderImagesWithCover } from "@/lib/properties/images";
import { safeTrim } from "@/lib/agents/agent-storefront";
import {
  normalizeClientPageCriteria,
  resolveClientPagePublicState,
  isClientPagePublished,
  orderCuratedListings,
  type ClientPageCriteria,
} from "@/lib/agents/client-pages";
import {
  getAgentStorefrontViewModel,
  type AgentStorefrontMetrics,
} from "@/lib/agents/agent-storefront.server";
import type { StorefrontFailureReason } from "@/lib/agents/agent-storefront";

const IMAGE_SELECT = "id,image_url,position,created_at,width,height,bytes,format";
const PROPERTY_SELECT = `*, property_images(${IMAGE_SELECT})`;

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

type PropertyRow = Property & {
  property_images?: PropertyImageRow[] | null;
};

type ClientPageRow = {
  id: string;
  agent_user_id: string;
  agent_slug: string;
  client_slug: string;
  client_name?: string | null;
  title?: string | null;
  client_brief?: string | null;
  client_requirements?: string | null;
  agent_about?: string | null;
  agent_company_name?: string | null;
  agent_logo_url?: string | null;
  banner_url?: string | null;
  notes_md?: string | null;
  criteria?: ClientPageCriteria | null;
  pinned_property_ids?: string[] | null;
  published?: boolean | null;
  published_at?: string | null;
  expires_at?: string | null;
  unpublished_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CuratedListingRow = {
  property_id: string;
  rank?: number | null;
  pinned?: boolean | null;
};

type ClientPagePublicResult =
  | {
      ok: false;
      reason: StorefrontFailureReason | "NOT_FOUND";
      redirectSlug?: string | null;
    }
  | {
      ok: true;
      agent: {
        id: string;
        name: string;
        avatarUrl: string | null;
        bio: string | null;
        slug: string | null;
        companyName: string | null;
        logoUrl: string | null;
        bannerUrl: string | null;
        about: string | null;
      };
      client: {
        id: string;
        slug: string;
        name: string | null;
        title: string | null;
        brief: string | null;
        requirements: string | null;
        notes: string | null;
      };
      listings: Property[];
      metrics: AgentStorefrontMetrics | null;
    };

function mapPropertyRows(rows: PropertyRow[] | null | undefined): Property[] {
  return (rows ?? []).map((row) => ({
    ...row,
    images: orderImagesWithCover(
      row.cover_image_url,
      row.property_images?.map((img) => ({
        id: img.id || img.image_url,
        image_url: img.image_url,
        position: img.position ?? null,
        created_at: img.created_at ?? undefined,
        width: img.width ?? null,
        height: img.height ?? null,
        bytes: img.bytes ?? null,
        format: img.format ?? null,
      }))
    ),
  }));
}

function orderPinnedListings(listings: Property[], pinnedIds: string[]) {
  const order = new Map(pinnedIds.map((id, index) => [id, index]));
  return [...listings].sort((a, b) => {
    const aIndex = order.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });
}

function normalizeClientSlug(input: unknown) {
  return safeTrim(input).toLowerCase();
}

export async function getAgentClientPagePublic(input: {
  agentSlug: string;
  clientSlug: string;
  requestId?: string;
}): Promise<ClientPagePublicResult> {
  const clientSlug = normalizeClientSlug(input.clientSlug);
  if (!clientSlug) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const storefront = await getAgentStorefrontViewModel(input.agentSlug, {
    requestId: input.requestId,
  });
  if (!storefront.ok) {
    return {
      ok: false,
      reason: storefront.reason,
      redirectSlug: storefront.redirectSlug ?? null,
    };
  }

  const agent = storefront.storefront.agent;
  const supabase = hasServiceRoleEnv()
    ? createServiceRoleClient()
    : await createServerSupabaseClient();

  const { data: page } = await supabase
    .from("agent_client_pages")
    .select(
      "id, agent_user_id, agent_slug, client_slug, client_name, title, client_brief, client_requirements, agent_about, agent_company_name, agent_logo_url, banner_url, notes_md, criteria, pinned_property_ids, published, published_at, expires_at, unpublished_at"
    )
    .eq("agent_user_id", agent.id)
    .eq("client_slug", clientSlug)
    .maybeSingle<ClientPageRow>();

  if (!page || !isClientPagePublished({ published: page.published, expiresAt: page.expires_at })) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const { data: curatedRowsRaw } = await supabase
    .from("agent_client_page_listings")
    .select("property_id, rank, pinned")
    .eq("client_page_id", page.id);

  const curatedRows = (curatedRowsRaw ?? []) as CuratedListingRow[];
  const curatedOrder = orderCuratedListings(
    curatedRows
      .map((row) => ({
        id: row.property_id,
        rank: row.rank ?? 0,
        pinned: row.pinned ?? false,
      }))
      .filter((row) => !!row.id)
  );

  const pinnedIds = (page.pinned_property_ids ?? []).filter((value) => !!value);
  let listings: Property[] = [];

  if (curatedOrder.length > 0) {
    const curatedIds = curatedOrder.map((row) => row.id);
    const { data: curatedPropertyRows } = await supabase
      .from("properties")
      .select(PROPERTY_SELECT)
      .eq("owner_id", agent.id)
      .eq("status", "live")
      .in("id", curatedIds);

    const curatedProperties = mapPropertyRows(curatedPropertyRows as PropertyRow[]);
    const propertyMap = new Map(curatedProperties.map((item) => [item.id, item]));
    listings = curatedOrder
      .map((row) => propertyMap.get(row.id))
      .filter((value): value is Property => Boolean(value));
  } else if (pinnedIds.length > 0) {
    const { data: pinnedRows } = await supabase
      .from("properties")
      .select(PROPERTY_SELECT)
      .eq("owner_id", agent.id)
      .eq("status", "live")
      .in("id", pinnedIds);

    listings = orderPinnedListings(mapPropertyRows(pinnedRows as PropertyRow[]), pinnedIds);
  } else {
    const criteria = normalizeClientPageCriteria(page.criteria ?? {});
    let query = supabase
      .from("properties")
      .select(PROPERTY_SELECT)
      .eq("owner_id", agent.id)
      .eq("status", "live");

    if (criteria.intent) {
      query = query.eq("listing_intent", criteria.intent);
    }
    if (criteria.city) {
      query = query.ilike("city", `%${criteria.city}%`);
    }
    if (typeof criteria.minPrice === "number") {
      query = query.gte("price", criteria.minPrice);
    }
    if (typeof criteria.maxPrice === "number") {
      query = query.lte("price", criteria.maxPrice);
    }
    if (typeof criteria.bedrooms === "number") {
      query = query.gte("bedrooms", criteria.bedrooms);
    }
    if (criteria.listingType) {
      query = query.eq("listing_type", criteria.listingType);
    }

    const { data: criteriaRows } = await query
      .order("updated_at", { ascending: false })
      .limit(24);

    listings = mapPropertyRows(criteriaRows as PropertyRow[]);
  }

  const publicState = resolveClientPagePublicState({
    published: page.published === true,
    listings,
  });

  return {
    ok: true,
    agent: {
      ...agent,
      companyName: page.agent_company_name ?? null,
      logoUrl: page.agent_logo_url ?? null,
      bannerUrl: page.banner_url ?? null,
      about: page.agent_about ?? null,
    },
    client: {
      id: page.id,
      slug: page.client_slug,
      name: page.client_name ?? null,
      title: page.title ?? null,
      brief: page.client_brief ?? null,
      requirements: page.client_requirements ?? null,
      notes: page.notes_md ?? null,
    },
    listings: publicState.listings,
    metrics: storefront.metrics ?? null,
  };
}
