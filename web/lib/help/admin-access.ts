import { fetchUserRole } from "@/lib/auth/role";
import { isAdminRole } from "@/lib/roles";

type SupabaseClient = Parameters<typeof fetchUserRole>[0];

export async function canAccessAdminHelp(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const role = await fetchUserRole(supabase, userId);
  return isAdminRole(role);
}
