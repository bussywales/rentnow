import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { HelpTutorialRecord } from "@/lib/help/tutorials";

export async function requireAdminHelpAuthoring(redirectPath: string) {
  if (!hasServerSupabaseEnv()) {
    redirect(`/auth/required?redirect=${encodeURIComponent(redirectPath)}&reason=auth`);
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect(`/auth/required?redirect=${encodeURIComponent(redirectPath)}&reason=auth`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  return { supabase, user };
}

export async function listHelpTutorialsForAdmin() {
  const { supabase } = await requireAdminHelpAuthoring("/admin/help/tutorials");
  const { data, error } = await supabase
    .from("help_tutorials")
    .select(
      "id,title,slug,summary,audience,visibility,status,video_url,body,created_by,updated_by,created_at,updated_at,published_at,unpublished_at"
    )
    .order("updated_at", { ascending: false });

  return {
    tutorials: (data as HelpTutorialRecord[] | null) ?? [],
    error: error?.message ?? null,
  };
}

export async function getHelpTutorialForAdmin(id: string, redirectPath: string) {
  const { supabase } = await requireAdminHelpAuthoring(redirectPath);
  const { data, error } = await supabase
    .from("help_tutorials")
    .select(
      "id,title,slug,summary,audience,visibility,status,video_url,body,created_by,updated_by,created_at,updated_at,published_at,unpublished_at"
    )
    .eq("id", id)
    .maybeSingle();

  return {
    tutorial: (data as HelpTutorialRecord | null) ?? null,
    error: error?.message ?? null,
  };
}
