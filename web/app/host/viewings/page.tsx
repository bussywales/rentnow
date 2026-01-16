import { redirect } from "next/navigation";
import { HostViewingsList } from "@/components/viewings/HostViewingsList";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export default async function HostViewingsPage() {
  if (!hasServerSupabaseEnv()) redirect("/forbidden");
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?reason=auth");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6" data-testid="host-viewings-page">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Viewings</p>
        <h1 className="text-2xl font-semibold text-slate-900">Host inbox</h1>
        <p className="text-sm text-slate-600">
          Review and respond to viewing requests. Times are shown in each property&apos;s timezone.
        </p>
      </div>
      <div className="mt-4">
        <HostViewingsList />
      </div>
    </div>
  );
}
