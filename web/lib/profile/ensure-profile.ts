export type ProfileRecord = {
  id: string;
  role?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  public_slug?: string | null;
  agent_storefront_enabled?: boolean | null;
  agent_slug?: string | null;
  agent_bio?: string | null;
  listing_review_email_enabled?: boolean | null;
  property_request_alerts_enabled?: boolean | null;
};

export const PROFILE_SELECT_FIELDS =
  "id, role, first_name, last_name, display_name, full_name, phone, avatar_url, public_slug, agent_storefront_enabled, agent_slug, agent_bio, listing_review_email_enabled, property_request_alerts_enabled";

const PROFILE_SELECT_FIELDS_LEGACY =
  "id, role, first_name, last_name, display_name, full_name, phone, avatar_url, public_slug, agent_storefront_enabled, agent_slug, agent_bio";

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
        maybeSingle: () => PromiseLike<{ data: ProfileRecord | null; error: SupabaseError | null }>;
      };
    };
    upsert: (
      payload: Record<string, unknown>,
      options?: { onConflict?: string }
    ) => PromiseLike<{ error: SupabaseError | null }>;
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
  const selected = await client
    .from("profiles")
    .select(PROFILE_SELECT_FIELDS)
    .eq("id", userId)
    .maybeSingle();
  if (selected.error && isUnknownColumn(selected.error, "property_request_alerts_enabled")) {
    const fallbackColumns = isUnknownColumn(selected.error, "listing_review_email_enabled")
      ? PROFILE_SELECT_FIELDS_LEGACY
      : "id, role, first_name, last_name, display_name, full_name, phone, avatar_url, public_slug, agent_storefront_enabled, agent_slug, agent_bio, listing_review_email_enabled";
    const fallback = await client
      .from("profiles")
      .select(fallbackColumns)
      .eq("id", userId)
      .maybeSingle();
    return {
      data: fallback.data
        ? {
            ...fallback.data,
            listing_review_email_enabled:
              "listing_review_email_enabled" in fallback.data
                ? fallback.data.listing_review_email_enabled ?? null
                : null,
            property_request_alerts_enabled: null,
          }
        : null,
      error: fallback.error,
    };
  }
  if (selected.error && isUnknownColumn(selected.error, "listing_review_email_enabled")) {
    const legacy = await client
      .from("profiles")
      .select(PROFILE_SELECT_FIELDS_LEGACY)
      .eq("id", userId)
      .maybeSingle();
    return {
      data: legacy.data ? { ...legacy.data, listing_review_email_enabled: null } : null,
      error: legacy.error,
    };
  }
  return selected;
}

export async function ensureProfileRow(input: EnsureProfileInput): Promise<EnsureProfileResult> {
  const { client, userId, email } = input;
  const existing = await fetchProfile(client, userId);
  if (existing.error) return { profile: null, created: false, error: existing.error };
  if (existing.data) return { profile: existing.data, created: false };

  const basePayload: Record<string, unknown> = {
    id: userId,
    first_name: null,
    last_name: null,
    display_name: null,
    full_name: null,
    phone: null,
    avatar_url: null,
    agent_storefront_enabled: false,
    listing_review_email_enabled: false,
    property_request_alerts_enabled: true,
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
    delete rest.listing_review_email_enabled;
    insertError = (await client.from("profiles").upsert(rest, { onConflict: "id" })).error;
  }

  if (insertError && isUnknownColumn(insertError, "listing_review_email_enabled")) {
    const rest = { ...payload };
    delete rest.listing_review_email_enabled;
    delete rest.property_request_alerts_enabled;
    insertError = (await client.from("profiles").upsert(rest, { onConflict: "id" })).error;
  }

  if (insertError && isUnknownColumn(insertError, "property_request_alerts_enabled")) {
    const rest = { ...payload };
    delete rest.property_request_alerts_enabled;
    insertError = (await client.from("profiles").upsert(rest, { onConflict: "id" })).error;
  }

  if (insertError && (isUnknownColumn(insertError, "first_name") || isUnknownColumn(insertError, "last_name"))) {
    const rest = { ...payload };
    delete rest.first_name;
    delete rest.last_name;
    insertError = (await client.from("profiles").upsert(rest, { onConflict: "id" })).error;
  }

  if (insertError) return { profile: null, created: false, error: insertError };

  const after = await fetchProfile(client, userId);
  if (after.error) return { profile: null, created: true, error: after.error };

  return { profile: after.data ?? null, created: true };
}
