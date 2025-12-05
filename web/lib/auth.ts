import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

export async function getSession() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("Error fetching session user", error.message);
    }

    return user ? ({ user } as unknown as { user: unknown }) : null;
  } catch (err) {
    console.warn("Session fetch failed; returning null", err);
    return null;
  }
}

export async function getProfile(): Promise<Profile | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile", error.message);
      return null;
    }

    return data as Profile | null;
  } catch (err) {
    console.warn("Profile fetch failed; returning null", err);
    return null;
  }
}

export async function requireRole(roles: UserRole[]) {
  const profile = await getProfile();
  if (!profile) redirect("/auth/login");
  if (!roles.includes(profile.role)) redirect("/");
  return profile;
}
