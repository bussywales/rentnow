import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import ProfileFormClient from "@/components/profile/ProfileFormClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/profile&reason=auth");
  }

  const session = await getSession();
  if (!session?.user) {
    redirect("/auth/login?reason=auth&redirect=/profile");
  }

  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, role, display_name, full_name, phone, avatar_url, agent_storefront_enabled, agent_slug, agent_bio"
    )
    .eq("id", session.user.id)
    .maybeSingle();

  const email = session.user.email ?? "";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Account</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Profile</h1>
        <p className="mt-2 text-sm text-slate-600">
          Update your details and keep your account secure.
        </p>
      </header>
      <ProfileFormClient userId={session.user.id} email={email} initialProfile={profile} />
    </div>
  );
}
