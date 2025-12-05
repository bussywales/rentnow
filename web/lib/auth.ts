import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/lib/types";

export async function getSession() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Error fetching session user", error.message);
    }

    const user = session?.user as User | null | undefined;
    return user ? ({ user } as { user: User }) : null;
  } catch (err) {
    console.warn("Session fetch failed; returning null", err);
    return null;
  }
}

export async function getProfile(): Promise<Profile | null> {
  try {
    const session = await getSession();
    if (!session?.user) return null;

    const supabase = await createServerSupabaseClient();

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
