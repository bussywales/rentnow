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
    data: { session },
  } = await supabase.auth.getSession();
  let user = session?.user ?? null;
  let sessionRefreshed = false;

  if (!user) {
    const {
      data: { session: refreshed },
    } = await supabase.auth.refreshSession();
    if (refreshed?.user) {
      user = refreshed.user;
      sessionRefreshed = true;
    }
  }

  if (!user) {
    const {
      data: { user: fallbackUser },
    } = await supabase.auth.getUser();
    user = fallbackUser ?? null;
  }

  return { supabase, user, sessionRefreshed };
}

export async function getServerAuthUser(): Promise<ResolvedServerUser> {
  const supabase = await createServerSupabaseClient();
  return resolveServerUser(supabase);
}
