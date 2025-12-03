import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

export async function getSession() {
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Error fetching session", error.message);
  }

  return session;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = createServerSupabaseClient();
  const session = await getSession();

  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile", error.message);
    return null;
  }

  return data as Profile | null;
}

export async function requireRole(roles: UserRole[]) {
  const profile = await getProfile();
  if (!profile) redirect("/auth/login");
  if (!roles.includes(profile.role)) redirect("/");
  return profile;
}
