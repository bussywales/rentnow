import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/lib/types";

type SupabaseAuthLike = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: User | null;
      };
      error?: { message?: string | null } | null;
    }>;
    refreshSession: () => Promise<{
      data?: { session?: unknown } | null;
      error?: { message?: string | null } | null;
    }>;
  };
};

const EXPECTED_MISSING_SESSION_MARKERS = [
  "auth session missing",
  "session missing",
  "invalid refresh token",
  "refresh token not found",
] as const;

export function isExpectedMissingSessionErrorMessage(
  value: string | null | undefined
) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;
  return EXPECTED_MISSING_SESSION_MARKERS.some((marker) =>
    normalized.includes(marker)
  );
}

export async function resolveSessionUserFromSupabase(
  supabase: SupabaseAuthLike
) {
  try {
    const {
      data: { user: initialUser },
      error,
    } = await supabase.auth.getUser();

    if (error && !isExpectedMissingSessionErrorMessage(error.message)) {
      console.error("Error fetching session user", error.message);
    }

    let user = initialUser as User | null | undefined;
    if (!user) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (
        refreshError &&
        !isExpectedMissingSessionErrorMessage(refreshError.message)
      ) {
        console.error("Error refreshing session user", refreshError.message);
      }
      if (refreshed?.session) {
        const {
          data: { user: refreshedUser },
          error: refreshedUserError,
        } = await supabase.auth.getUser();
        if (
          refreshedUserError &&
          !isExpectedMissingSessionErrorMessage(refreshedUserError.message)
        ) {
          console.error("Error fetching refreshed session user", refreshedUserError.message);
        }
        user = refreshedUser as User | null | undefined;
      }
    }

    return user ?? null;
  } catch (err) {
    console.warn("Session fetch failed; returning null", err);
    return null;
  }
}

export async function getSession() {
  const supabase = await createServerSupabaseClient();
  const user = await resolveSessionUserFromSupabase(
    supabase as unknown as SupabaseAuthLike
  );
  return user ? ({ user } as { user: User }) : null;
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
  if (!profile.role) redirect("/onboarding");
  if (!roles.includes(profile.role)) redirect("/");
  return profile;
}
