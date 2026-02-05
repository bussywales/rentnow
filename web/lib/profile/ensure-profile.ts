export type ProfileRecord = {
  id: string;
  role?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  agent_storefront_enabled?: boolean | null;
  agent_slug?: string | null;
  agent_bio?: string | null;
};

export const PROFILE_SELECT_FIELDS =
  "id, role, display_name, full_name, phone, avatar_url, agent_storefront_enabled, agent_slug, agent_bio";

type SupabaseError = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

type SupabaseProfileClient = {
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: ProfileRecord | null; error: SupabaseError | null }>;
      };
    };
    upsert: (
      payload: Record<string, unknown>,
      options?: { onConflict?: string }
    ) => Promise<{ error: SupabaseError | null }>;
  };
};

type EnsureProfileInput = {
  client: SupabaseProfileClient;
  userId: string;
  email?: string | null;
};

type EnsureProfileResult = {
  profile: ProfileRecord | null;
  created: boolean;
  error?: SupabaseError | null;
};

function isUnknownColumn(error: SupabaseError | null, column: string) {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes(`column \"${column.toLowerCase()}\"`) && message.includes("does not exist");
}

async function fetchProfile(
  client: SupabaseProfileClient,
  userId: string
): Promise<{ data: ProfileRecord | null; error: SupabaseError | null }> {
  return client
    .from("profiles")
    .select(PROFILE_SELECT_FIELDS)
    .eq("id", userId)
    .maybeSingle();
}

export async function ensureProfileRow(input: EnsureProfileInput): Promise<EnsureProfileResult> {
  const { client, userId, email } = input;
  const existing = await fetchProfile(client, userId);
  if (existing.error) return { profile: null, created: false, error: existing.error };
  if (existing.data) return { profile: existing.data, created: false };

  const basePayload: Record<string, unknown> = {
    id: userId,
    display_name: null,
    full_name: null,
    phone: null,
    avatar_url: null,
    agent_storefront_enabled: false,
  };

  const trimmedEmail = email?.trim();
  let payload: Record<string, unknown> = trimmedEmail
    ? { ...basePayload, email: trimmedEmail }
    : basePayload;

  let insertError = (await client.from("profiles").upsert(payload, { onConflict: "id" })).error;

  if (insertError && trimmedEmail && isUnknownColumn(insertError, "email")) {
    payload = basePayload;
    insertError = (await client.from("profiles").upsert(payload, { onConflict: "id" })).error;
  }

  if (insertError && isUnknownColumn(insertError, "agent_storefront_enabled")) {
    const rest = { ...payload };
    delete rest.agent_storefront_enabled;
    insertError = (await client.from("profiles").upsert(rest, { onConflict: "id" })).error;
  }

  if (insertError) return { profile: null, created: false, error: insertError };

  const after = await fetchProfile(client, userId);
  if (after.error) return { profile: null, created: true, error: after.error };

  return { profile: after.data ?? null, created: true };
}
