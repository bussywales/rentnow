import type { Property } from "@/lib/types";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { orderImagesWithCover } from "@/lib/properties/images";
import {
  ensureUniqueSlug,
  resolveAgentSlugBase,
  resolveStorefrontPublicOutcome,
  resolveStorefrontOwnerId,
  safeTrim,
  type StorefrontFailureReason,
  type StorefrontPublicRow,
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

type AgentStorefrontRow = {
  user_id: string;
  slug: string;
  enabled: boolean;
  bio?: string | null;
};

async function upsertAgentStorefrontRow(input: {
  client: ReturnType<typeof createServiceRoleClient>;
  userId: string;
  slug: string;
  enabled: boolean;
  bio: string | null;
}): Promise<boolean> {
  const storefrontsTable = input.client.from("agent_storefronts") as unknown as {
    upsert: (
      values: AgentStorefrontRow,
      options?: { onConflict?: string }
    ) => Promise<{ error: { message?: string } | null }>;
  };

  const { error } = await storefrontsTable.upsert(
    {
      user_id: input.userId,
      slug: input.slug,
      enabled: input.enabled,
      bio: input.bio,
    },
    { onConflict: "user_id" }
  );

  return !error;
}

async function attemptBackfillStorefront(input: {
  slug: string;
}): Promise<boolean> {
  if (!hasServiceRoleEnv()) return false;
  const client = createServiceRoleClient();
  const { data: profile } = await client
    .from("profiles")
    .select(
      "id, role, display_name, full_name, business_name, agent_slug, agent_storefront_enabled, agent_bio"
    )
    .ilike("agent_slug", input.slug)
    .maybeSingle<AgentRow>();

  if (!profile || profile.role !== "agent") return false;
  const fallbackSlug =
    safeTrim(profile.agent_slug) || resolveAgentSlugBase({
      displayName: profile.display_name,
      fullName: profile.full_name,
      businessName: profile.business_name,
      userId: profile.id,
    });

  if (!fallbackSlug) return false;
  const enabled = profile.agent_storefront_enabled ?? true;
  const bio = profile.agent_bio ?? null;
  return upsertAgentStorefrontRow({
    client,
    userId: profile.id,
    slug: fallbackSlug,
    enabled,
    bio,
  });
}

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

export async function getAgentStorefrontData(
  slug: string,
  options?: { requestId?: string }
): Promise<AgentStorefrontResult> {
  const normalizedSlug = safeTrim(slug).toLowerCase();
  if (!normalizedSlug) {
    return { ok: false, reason: "MISSING_SLUG", slug: normalizedSlug };
  }

  const hasServiceRole = hasServiceRoleEnv();
  const client = hasServiceRole ? createServiceRoleClient() : await createServerSupabaseClient();
  const fetchPublicRow = async (requestedSlug: string) => {
    const response = await client.rpc("get_agent_storefront_public", {
      input_slug: requestedSlug,
    });
    const row = (Array.isArray(response.data) ? response.data[0] : response.data) as
      | StorefrontPublicRow
      | null
      | undefined;
    return { row, error: response.error };
  };

  let { row: publicRow, error: publicError } = await fetchPublicRow(normalizedSlug);

  let publicOutcome = resolveStorefrontPublicOutcome(publicRow ?? null);
  let publicReason = publicOutcome.ok ? null : publicOutcome.reason;
  const globalEnabled = publicRow?.global_enabled ?? true;
  const agentEnabled = publicRow?.agent_storefront_enabled ?? null;
  const agentRole = publicRow?.role ?? null;
  const resolvedSlug = safeTrim(publicRow?.slug).toLowerCase();

  if (publicOutcome.ok && resolvedSlug && resolvedSlug !== normalizedSlug) {
    return {
      ok: false,
      reason: "NOT_FOUND",
      slug: normalizedSlug,
      redirectSlug: resolvedSlug,
    };
  }

  if (!publicOutcome.ok && publicReason === "NOT_FOUND" && hasServiceRole) {
    const backfilled = await attemptBackfillStorefront({ slug: normalizedSlug });
    if (backfilled) {
      const retry = await fetchPublicRow(normalizedSlug);
      publicError = retry.error;
      publicRow = retry.row;
      publicOutcome = resolveStorefrontPublicOutcome(publicRow ?? null);
      publicReason = publicOutcome.ok ? null : publicOutcome.reason;
    }
  }

  if (!publicOutcome.ok && publicReason === "NOT_FOUND") {
    const numericFallback = normalizedSlug.replace(/-\d+$/, "");
    if (numericFallback && numericFallback !== normalizedSlug) {
      const retry = await fetchPublicRow(numericFallback);
      if (!retry.error) {
        const retryOutcome = resolveStorefrontPublicOutcome(retry.row ?? null);
        if (retryOutcome.ok) {
          const fallbackSlug = safeTrim(retry.row?.slug).toLowerCase();
          if (fallbackSlug) {
            return {
              ok: false,
              reason: "NOT_FOUND",
              slug: normalizedSlug,
              redirectSlug: fallbackSlug,
            };
          }
        }
      }
    }
  }

  if (publicError || !publicOutcome.ok) {
    const requestId = options?.requestId;
    if (publicError) {
      console.error("[agent-storefront] rpc error", {
        requestId,
        slug: normalizedSlug,
        code: publicError.code,
        message: publicError.message,
        details: publicError.details,
      });
    }
    console.warn("[agent-storefront] unavailable", {
      requestId,
      slug: normalizedSlug,
      reason: publicReason,
      globalEnabled,
      agentEnabled,
      role: agentRole,
    });
    return {
      ok: false,
      reason: publicReason ?? "NOT_FOUND",
      slug: normalizedSlug,
    };
  }

  const profile: AgentRow = {
    id: publicRow?.agent_user_id ?? "",
    role: agentRole,
    display_name: publicRow?.display_name ?? null,
    full_name: null,
    business_name: null,
    avatar_url: publicRow?.avatar_url ?? null,
    agent_bio: publicRow?.public_bio ?? null,
    agent_slug: publicRow?.slug ?? normalizedSlug,
    agent_storefront_enabled: agentEnabled ?? true,
  };

  const ownerId = resolveStorefrontOwnerId(publicRow ?? null);
  let listings: Property[] = [];
  if (ownerId) {
    const { data: listingRows } = await client
      .from("properties")
      .select(PROPERTY_SELECT)
      .eq("owner_id", ownerId)
      .eq("status", "live")
      .order("updated_at", { ascending: false });
    listings = mapPropertyRows(listingRows as PropertyRow[]);
  }
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
  force?: boolean;
  enabled?: boolean | null;
  bio?: string | null;
}): Promise<string | null> {
  if (!hasServiceRoleEnv()) return null;
  const client = createServiceRoleClient();

  const { data: profile } = await client
    .from("profiles")
    .select(
      "id, role, display_name, full_name, business_name, agent_slug, agent_storefront_enabled, agent_bio"
    )
    .eq("id", input.userId)
    .maybeSingle<AgentRow>();

  if (!profile || profile.role !== "agent") return null;
  const shouldForce = input.force === true;
  const storefrontEnabled =
    input.enabled ?? profile.agent_storefront_enabled ?? true;
  const storefrontBio = input.bio ?? profile.agent_bio ?? null;
  if (!profile.agent_slug && !shouldForce && !storefrontEnabled) {
    return null;
  }
  if (profile.agent_slug && !shouldForce) {
    await upsertAgentStorefrontRow({
      client,
      userId: profile.id,
      slug: profile.agent_slug,
      enabled: storefrontEnabled,
      bio: storefrontBio,
    });
    return profile.agent_slug;
  }

  const baseSlug = resolveAgentSlugBase({
    currentSlug: shouldForce ? null : profile.agent_slug,
    displayName: input.displayName ?? profile.display_name,
    fullName: profile.full_name,
    businessName: profile.business_name,
    userId: input.userId,
  });

  const { data: existingRows } = await client
    .from("agent_storefronts")
    .select("user_id, slug")
    .ilike("slug", `${baseSlug}%`);
  const { data: legacyRows } = await client
    .from("profiles")
    .select("id, agent_slug")
    .ilike("agent_slug", `${baseSlug}%`);

  const existing = [
    ...((existingRows ?? []) as Array<{ user_id: string; slug: string | null }>)
      .filter((row) => row.user_id !== input.userId)
      .map((row) => row.slug),
    ...((legacyRows ?? []) as Array<{ id: string; agent_slug: string | null }>)
      .filter((row) => row.id !== input.userId)
      .map((row) => row.agent_slug),
  ].filter((value): value is string => typeof value === "string");

  if (shouldForce && profile.agent_slug) {
    existing.push(profile.agent_slug);
  }

  const nextSlug = ensureUniqueSlug(baseSlug, existing);

  const profileTable = client.from("profiles") as unknown as {
    update: (values: { agent_slug: string }) => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
    };
  };

  const { error } = await profileTable.update({ agent_slug: nextSlug }).eq("id", input.userId);

  if (error) return null;
  const storefrontSaved = await upsertAgentStorefrontRow({
    client,
    userId: input.userId,
    slug: nextSlug,
    enabled: storefrontEnabled,
    bio: storefrontBio,
  });
  if (!storefrontSaved) return null;
  return nextSlug;
}
