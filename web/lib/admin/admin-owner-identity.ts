import { formatRoleLabel } from "@/lib/roles";
import type { createServiceRoleClient } from "@/lib/supabase/admin";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseAdminClient = ReturnType<typeof createServiceRoleClient>;

type OwnerProfileRow = {
  id: string;
  full_name?: string | null;
  role?: string | null;
};

export type AdminOwnerIdentity = {
  id: string;
  name: string | null;
  email: string | null;
  hostLabel: string;
};

export type AdminOwnerIdentityDisplay = {
  primaryLabel: string;
  secondaryLabel: string | null;
  primaryKind: "name" | "email" | "ownerId" | "hostLabel";
};

function normalizeText(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed.length ? trimmed : null;
}

async function fetchOwnerEmailMap(
  adminClient: SupabaseAdminClient | null | undefined,
  ownerIds: string[]
): Promise<Record<string, string | null>> {
  if (!adminClient || !ownerIds.length) return {};
  const results = await Promise.allSettled(
    ownerIds.map(async (ownerId) => {
      const { data } = await adminClient.auth.admin.getUserById(ownerId);
      return [ownerId, normalizeText(data.user?.email)] as const;
    })
  );

  return Object.fromEntries(
    results.map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      return [ownerIds[index] ?? "", null] as const;
    })
  );
}

export async function fetchAdminOwnerIdentityMap(input: {
  supabase: SupabaseServerClient;
  ownerIds: string[];
  adminClient?: SupabaseAdminClient | null;
}): Promise<Record<string, AdminOwnerIdentity>> {
  const ownerIds = Array.from(new Set(input.ownerIds.filter(Boolean)));
  if (!ownerIds.length) return {};

  const [{ data: profiles }, emailMap] = await Promise.all([
    input.supabase.from("profiles").select("id, full_name, role").in("id", ownerIds),
    fetchOwnerEmailMap(input.adminClient, ownerIds),
  ]);

  const profileMap = new Map<string, OwnerProfileRow>(
    ((profiles as OwnerProfileRow[] | null) ?? []).map((profile) => [profile.id, profile])
  );

  return Object.fromEntries(
    ownerIds.map((ownerId) => {
      const profile = profileMap.get(ownerId);
      const name = normalizeText(profile?.full_name);
      return [
        ownerId,
        {
          id: ownerId,
          name,
          email: emailMap[ownerId] ?? null,
          hostLabel: name || formatRoleLabel(profile?.role || undefined) || "Host",
        },
      ] satisfies [string, AdminOwnerIdentity];
    })
  );
}

export function resolveAdminOwnerIdentityDisplay(input: {
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerId?: string | null;
  hostName?: string | null;
}): AdminOwnerIdentityDisplay {
  const ownerName = normalizeText(input.ownerName);
  const ownerEmail = normalizeText(input.ownerEmail);
  const ownerId = normalizeText(input.ownerId);
  const hostName = normalizeText(input.hostName) || "Host";

  if (ownerName) {
    return {
      primaryLabel: ownerName,
      secondaryLabel: ownerEmail,
      primaryKind: "name",
    };
  }
  if (ownerEmail) {
    return {
      primaryLabel: ownerEmail,
      secondaryLabel: null,
      primaryKind: "email",
    };
  }
  if (ownerId) {
    return {
      primaryLabel: ownerId,
      secondaryLabel: null,
      primaryKind: "ownerId",
    };
  }
  return {
    primaryLabel: hostName,
    secondaryLabel: null,
    primaryKind: "hostLabel",
  };
}
