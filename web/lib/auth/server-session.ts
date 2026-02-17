import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type ResolvedServerUser = {
  supabase: SupabaseClient;
  user: User | null;
  sessionRefreshed: boolean;
};

export async function resolveServerUser(
  supabase: SupabaseClient
): Promise<ResolvedServerUser> {
  const {
    data: { user: initialUser },
  } = await supabase.auth.getUser();
  let user = initialUser ?? null;
  let sessionRefreshed = false;

  if (!user) {
    const { data: refreshedData } = await supabase.auth.refreshSession();
    if (refreshedData?.session) {
      const {
        data: { user: refreshedUser },
      } = await supabase.auth.getUser();
      user = refreshedUser ?? null;
      sessionRefreshed = true;
    }
  }

  return { supabase, user, sessionRefreshed };
}

export async function getServerAuthUser(): Promise<ResolvedServerUser> {
  const supabase = await createServerSupabaseClient();
  return resolveServerUser(supabase);
}
