import type { Property } from "@/lib/types";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { orderImagesWithCover } from "@/lib/properties/images";
import {
  ensureUniqueSlug,
  resolveStorefrontAvailability,
  slugifyAgentName,
  type StorefrontAvailabilityReason,
} from "@/lib/agents/agent-storefront";

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

type AgentRow = {
  id: string;
  role?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  business_name?: string | null;
  avatar_url?: string | null;
  agent_bio?: string | null;
  agent_slug?: string | null;
  agent_storefront_enabled?: boolean | null;
};

export type AgentStorefrontResult = {
  available: boolean;
  reason?: StorefrontAvailabilityReason;
  agent?: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    slug: string | null;
  };
  listings: Property[];
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

export async function getAgentStorefrontData(slug: string): Promise<AgentStorefrontResult> {
  const globalEnabled = await getAppSettingBool("agent_storefronts_enabled", true);
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    return { available: false, reason: "not_found", listings: [] };
  }
  if (!globalEnabled) {
    return { available: false, reason: "global_disabled", listings: [] };
  }

  const client = hasServiceRoleEnv()
    ? createServiceRoleClient()
    : await createServerSupabaseClient();

  const { data: profile } = await client
    .from("profiles")
    .select(
      "id, role, display_name, full_name, business_name, avatar_url, agent_bio, agent_slug, agent_storefront_enabled"
    )
    .ilike("agent_slug", normalizedSlug)
    .maybeSingle<AgentRow>();

  const availability = resolveStorefrontAvailability({
    globalEnabled,
    agentFound: !!profile,
    agentEnabled: profile?.agent_storefront_enabled ?? null,
  });

  if (!availability.available || !profile || profile.role !== "agent") {
    return {
      available: false,
      reason: availability.available ? "not_found" : availability.reason,
      listings: [],
    };
  }

  const nowIso = new Date().toISOString();
  const { data: listingRows } = await client
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("owner_id", profile.id)
    .eq("status", "live")
    .eq("is_active", true)
    .eq("is_approved", true)
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
    .order("updated_at", { ascending: false });

  const listings = mapPropertyRows(listingRows as PropertyRow[]);
  const name =
    profile.display_name || profile.full_name || profile.business_name || "Agent";

  return {
    available: true,
    agent: {
      id: profile.id,
      name,
      avatarUrl: profile.avatar_url ?? null,
      bio: profile.agent_bio ?? null,
      slug: profile.agent_slug ?? null,
    },
    listings,
  };
}

export async function ensureAgentSlugForUser(input: {
  userId: string;
  displayName?: string | null;
}): Promise<string | null> {
  if (!hasServiceRoleEnv()) return null;
  const client = createServiceRoleClient();

  const { data: profile } = await client
    .from("profiles")
    .select("id, role, display_name, full_name, agent_slug")
    .eq("id", input.userId)
    .maybeSingle<AgentRow>();

  if (!profile || profile.role !== "agent") return null;
  if (profile.agent_slug) return profile.agent_slug;

  const baseRaw = input.displayName || profile.display_name || profile.full_name || "";
  const baseSlug = slugifyAgentName(baseRaw) || `agent-${input.userId.slice(0, 8)}`;

  const { data: existingRows } = await client
    .from("profiles")
    .select("id, agent_slug")
    .ilike("agent_slug", `${baseSlug}%`);

  const existing = ((existingRows ?? []) as Array<{
    id: string;
    agent_slug: string | null;
  }>)
    .filter((row) => row.id !== input.userId)
    .map((row) => row.agent_slug)
    .filter((value): value is string => typeof value === "string");

  const nextSlug = ensureUniqueSlug(baseSlug, existing);

  const profileTable = client.from("profiles") as unknown as {
    update: (values: { agent_slug: string }) => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
    };
  };

  const { error } = await profileTable.update({ agent_slug: nextSlug }).eq("id", input.userId);

  if (error) return null;
  return nextSlug;
}
