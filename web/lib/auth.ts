import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";
import { cookies } from "next/headers";

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

    if (user) {
      // Shape it like a session object where we care about user
      return { user } as unknown as { user: unknown };
    }

    // Fallback: attempt to restore session from auth cookie manually
    try {
      const cookieStore = cookies();
      const projectRef =
        process.env.SUPABASE_URL?.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] ||
        process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] ||
        null;
      const authCookieName = projectRef ? `sb-${projectRef}-auth-token` : null;
      const rawCookie = authCookieName ? cookieStore.get(authCookieName)?.value : null;
      if (rawCookie && typeof supabase.auth.setSession === "function") {
        const decoded = decodeURIComponent(rawCookie);
        const parsed = JSON.parse(decoded);
        const access_token =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (parsed as any)?.access_token ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (parsed as any)?.currentSession?.access_token;
        const refresh_token =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (parsed as any)?.refresh_token ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (parsed as any)?.currentSession?.refresh_token;

        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          const { data: retry } = await supabase.auth.getUser();
          if (retry?.user) {
            return { user: retry.user } as unknown as { user: unknown };
          }
        }
      }
    } catch (restoreErr) {
      console.warn("Session restore from cookie failed", restoreErr);
    }

    return null;
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
