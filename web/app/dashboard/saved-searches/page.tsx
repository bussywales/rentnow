import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { SavedSearchManager } from "@/components/search/SavedSearchManager";
import type { SavedSearch } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SavedSearchesPage() {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">Saved searches</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured; saved searches are unavailable.
        </p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?reason=auth");
  }

  const { data } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const searches = (data as SavedSearch[]) || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Saved searches</h1>
        <p className="text-sm text-slate-600">
          Manage saved filters and check new matches.
        </p>
      </div>
      <SavedSearchManager initialSearches={searches} />
    </div>
  );
}
