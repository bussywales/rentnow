import type { UserRole } from "@/lib/types";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";

export async function resolveHelpViewerRole(): Promise<UserRole | null> {
  if (!hasServerSupabaseEnv()) return null;
  try {
    const { role } = await resolveServerRole();
    return role;
  } catch {
    return null;
  }
}
