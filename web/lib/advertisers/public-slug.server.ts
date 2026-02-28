import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  getOrCreatePublicSlug,
  type SlugLookupClient,
  type SlugWriteClient,
} from "@/lib/advertisers/public-slug";

type PublicSlugProfileRow = {
  id?: string | null;
  role?: string | null;
  public_slug?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  business_name?: string | null;
};

export async function ensurePublicSlugForUser(input: {
  userId: string;
  displayName?: string | null;
}): Promise<string | null> {
  if (!hasServiceRoleEnv()) return null;
  const client = createServiceRoleClient();

  const { data } = await client
    .from("profiles")
    .select("id, role, public_slug, display_name, full_name, business_name")
    .eq("id", input.userId)
    .maybeSingle();
  const profile = (data as PublicSlugProfileRow | null) ?? null;
  if (!profile?.id) return null;

  return getOrCreatePublicSlug({
    profile: {
      id: profile.id,
      role: profile.role,
      public_slug: profile.public_slug,
      display_name: profile.display_name || input.displayName || null,
      full_name: profile.full_name,
      business_name: profile.business_name,
    },
    lookupClient: client as unknown as SlugLookupClient,
    writeClient: client as unknown as SlugWriteClient,
    canPersist: true,
  });
}
