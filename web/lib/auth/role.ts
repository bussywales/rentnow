import type { User } from "@supabase/supabase-js";
import { normalizeRole } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function fetchUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRole | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return normalizeRole(profile?.role) ?? null;
}

export async function resolveServerRole(): Promise<{
  supabase: SupabaseClient;
  user: User | null;
  role: UserRole | null;
}> {
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    return { supabase, user: null, role: null };
  }
  const role = await fetchUserRole(supabase, user.id);
  return { supabase, user, role };
}
