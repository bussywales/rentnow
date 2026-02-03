import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminHelpLayout({ children }: { children: React.ReactNode }) {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/help/admin&reason=auth");
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/help/admin&reason=auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>;
}
