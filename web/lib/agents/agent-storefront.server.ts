import type { Property } from "@/lib/types";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { orderImagesWithCover } from "@/lib/properties/images";
import {
  ensureUniqueSlug,
  resolveAgentSlugBase,
  resolveStorefrontAccess,
  resolveLegacySlugRedirect,
  safeTrim,
  type StorefrontFailureReason,
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

export type AgentStorefrontResult =
  | {
      ok: true;
      slug: string;
      storefront: {
        agent: {
          id: string;
          name: string;
          avatarUrl: string | null;
          bio: string | null;
          slug: string | null;
        };
        listings: Property[];
      };
    }
  | {
      ok: false;
      slug: string;
      reason: StorefrontFailureReason;
      redirectSlug?: string | null;
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
  const normalizedSlug = safeTrim(slug).toLowerCase();
  const globalEnabled = await getAppSettingBool("agent_storefronts_enabled", true);
  if (!globalEnabled) {
    return { ok: false, reason: "GLOBAL_DISABLED", slug: normalizedSlug };
  }
  if (!normalizedSlug) {
    return { ok: false, reason: "MISSING_SLUG", slug: normalizedSlug };
  }

  const client = hasServiceRoleEnv()
    ? createServiceRoleClient()
    : await createServerSupabaseClient();

  const { data: exactProfile } = await client
    .from("profiles")
    .select(
      "id, role, display_name, full_name, business_name, avatar_url, agent_bio, agent_slug, agent_storefront_enabled"
    )
    .eq("agent_slug", normalizedSlug)
    .maybeSingle<AgentRow>();

  let profile = exactProfile;
  if (!profile) {
    const { data: caseInsensitiveProfile } = await client
      .from("profiles")
      .select(
        "id, role, display_name, full_name, business_name, avatar_url, agent_bio, agent_slug, agent_storefront_enabled"
      )
      .ilike("agent_slug", normalizedSlug)
      .maybeSingle<AgentRow>();
    profile = caseInsensitiveProfile ?? null;
  }
  if (!profile) {
    const candidateName = safeTrim(slug).replace(/-/g, " ");
    if (candidateName) {
      const safeCandidate = candidateName.replace(/[%_]/g, "\\$&");
      const { data: candidates } = await client
        .from("profiles")
        .select(
          "id, role, display_name, full_name, business_name, avatar_url, agent_bio, agent_slug, agent_storefront_enabled"
        )
        .eq("role", "agent")
        .not("agent_slug", "is", null)
        .or(
          `display_name.ilike.%${safeCandidate}%,full_name.ilike.%${safeCandidate}%,business_name.ilike.%${safeCandidate}%`
        );

      const matches =
        candidates
          ?.map((candidate) => ({
            candidate,
            redirectSlug: resolveLegacySlugRedirect({
              requestedSlug: normalizedSlug,
              profile: candidate,
            }),
          }))
          .filter((match) => !!match.redirectSlug) ?? [];

      if (matches.length === 1) {
        return {
          ok: false,
          reason: "NOT_FOUND",
          slug: normalizedSlug,
          redirectSlug: matches[0].redirectSlug ?? null,
        };
      }
    }
  }

  const access = resolveStorefrontAccess({
    slug: normalizedSlug,
    globalEnabled,
    agentFound: !!profile,
    agentRole: profile?.role ?? null,
    agentEnabled: profile?.agent_storefront_enabled ?? null,
  });

  if (!access.ok || !profile) {
    return {
      ok: false,
      reason: access.ok ? "NOT_FOUND" : access.reason,
      slug: normalizedSlug,
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
    safeTrim(profile.display_name) ||
    safeTrim(profile.full_name) ||
    safeTrim(profile.business_name) ||
    "Agent";

  return {
    ok: true,
    slug: normalizedSlug,
    storefront: {
      agent: {
        id: profile.id,
        name,
        avatarUrl: profile.avatar_url ?? null,
        bio: profile.agent_bio ?? null,
        slug: profile.agent_slug ?? null,
      },
      listings,
    },
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

  const baseSlug = resolveAgentSlugBase({
    currentSlug: profile.agent_slug,
    displayName: input.displayName ?? profile.display_name,
    fullName: profile.full_name,
    businessName: profile.business_name,
    userId: input.userId,
  });

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
