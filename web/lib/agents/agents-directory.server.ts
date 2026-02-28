import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  derivePublicAdvertiserName,
  normalizePublicSlug,
  type PublicAdvertiserProfileRow,
} from "@/lib/advertisers/public-profile";
import { getVerificationRequirements } from "@/lib/settings/app-settings.server";
import { isAdvertiserVerified } from "@/lib/trust-markers";

const DIRECTORY_SOURCE_CAP = 2000;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;

type AgentDirectoryProfileRow = PublicAdvertiserProfileRow & {
  role?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  bank_verified?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type AgentDirectoryCandidate = {
  item: AgentsDirectoryItem;
  searchableText: string;
  locationText: string;
  sortTimestamp: number;
};

export type AgentsDirectoryItem = {
  id: string;
  displayName: string;
  slug?: string | null;
  location?: string | null;
  verified: boolean;
  avatarUrl?: string | null;
  href: string;
};

export type SearchAgentsDirectoryInput = {
  q?: string | null;
  location?: string | null;
  verifiedOnly?: boolean;
  limit?: number;
  offset?: number;
};

export type SearchAgentsDirectoryResult = {
  items: AgentsDirectoryItem[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
};

export function resolveAgentsDirectoryHref(input: {
  advertiserId: string;
  publicSlug?: string | null;
}): string {
  const advertiserId = typeof input.advertiserId === "string" ? input.advertiserId.trim() : "";
  if (!advertiserId) return "/agents";
  const slug = normalizePublicSlug(input.publicSlug);
  if (slug) return `/agents/${slug}`;
  return `/agents/u/${advertiserId}`;
}

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeLimit(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value as number)));
}

function normalizeOffset(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Math.max(0, Math.floor(value as number));
}

function parseTimestamp(value?: string | null) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildLocation(row: AgentDirectoryProfileRow) {
  const city = typeof row.city === "string" ? row.city.trim() : "";
  return city || null;
}

function toDirectoryCandidate(
  row: AgentDirectoryProfileRow,
  requirements: Awaited<ReturnType<typeof getVerificationRequirements>>
): AgentDirectoryCandidate | null {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) return null;

  const displayName = derivePublicAdvertiserName(row);
  const slug = normalizePublicSlug(row.public_slug);
  const location = buildLocation(row);
  const verified = isAdvertiserVerified(
    {
      email_verified: row.email_verified ?? null,
      phone_verified: row.phone_verified ?? null,
      bank_verified: row.bank_verified ?? null,
    },
    requirements
  );
  const href = resolveAgentsDirectoryHref({
    advertiserId: id,
    publicSlug: slug,
  });

  const searchableText = normalizeText(
    [displayName, row.business_name, row.full_name, row.city].filter(Boolean).join(" ")
  );
  const locationText = normalizeText([row.city].filter(Boolean).join(" "));

  return {
    item: {
      id,
      displayName,
      slug,
      location,
      verified,
      avatarUrl: row.avatar_url ?? null,
      href,
    },
    searchableText,
    locationText,
    sortTimestamp: parseTimestamp(row.updated_at) || parseTimestamp(row.created_at),
  };
}

export async function searchAgentsDirectory(
  input: SearchAgentsDirectoryInput = {}
): Promise<SearchAgentsDirectoryResult> {
  const limit = normalizeLimit(input.limit);
  const offset = normalizeOffset(input.offset);
  const verifiedOnly = input.verifiedOnly !== false;
  const queryText = normalizeText(input.q);
  const locationText = normalizeText(input.location);

  if (!hasServerSupabaseEnv()) {
    return { items: [], total: 0, hasMore: false, limit, offset };
  }

  const client = hasServiceRoleEnv()
    ? createServiceRoleClient()
    : await createServerSupabaseClient();
  const requirements = await getVerificationRequirements(client);

  let query = client
    .from("profiles")
    .select(
      "id, role, display_name, full_name, business_name, public_slug, avatar_url, city, email_verified, phone_verified, bank_verified, updated_at, created_at"
    )
    .eq("role", "agent")
    .order("updated_at", { ascending: false })
    .range(0, DIRECTORY_SOURCE_CAP - 1);

  if (requirements.requireEmail) {
    query = query.eq("email_verified", true);
  }
  if (requirements.requirePhone) {
    query = query.eq("phone_verified", true);
  }
  if (requirements.requireBank) {
    query = query.eq("bank_verified", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Unable to load agents directory.");
  }

  const rows = ((data as AgentDirectoryProfileRow[] | null) ?? [])
    .map((row) => toDirectoryCandidate(row, requirements))
    .filter((row): row is AgentDirectoryCandidate => !!row);

  const filtered = rows
    .filter((row) => (verifiedOnly ? row.item.verified : true))
    .filter((row) => (queryText ? row.searchableText.includes(queryText) : true))
    .filter((row) => (locationText ? row.locationText.includes(locationText) : true))
    .sort((a, b) => {
      if (a.item.verified !== b.item.verified) {
        return a.item.verified ? -1 : 1;
      }
      return b.sortTimestamp - a.sortTimestamp;
    });

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit).map((row) => row.item);

  return {
    items: page,
    total,
    hasMore: offset + page.length < total,
    limit,
    offset,
  };
}
