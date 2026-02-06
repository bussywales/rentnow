import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";
import AgentClientPagesClient from "@/components/agents/AgentClientPagesClient";

export const dynamic = "force-dynamic";

export default async function AgentClientPagesPage() {
  if (!hasServerSupabaseEnv()) {
    redirect("/forbidden");
  }

  const { user, role } = await resolveServerRole();
  if (!user) {
    redirect("/auth/login?reason=auth&redirect=/profile/clients");
  }
  if (role !== "agent") {
    redirect("/forbidden?reason=role");
  }

  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, agent_slug")
    .eq("id", user.id)
    .maybeSingle();

  const { data: pages } = await supabase
    .from("agent_client_pages")
    .select(
      "id, client_name, client_slug, client_brief, title, criteria, pinned_property_ids, published, updated_at"
    )
    .eq("agent_user_id", user.id)
    .order("updated_at", { ascending: false });

  const { data: properties } = await supabase
    .from("properties")
    .select("id, title, city, price, currency")
    .eq("owner_id", user.id)
    .eq("status", "live")
    .order("updated_at", { ascending: false });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.propatyhub.com";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Agent tools</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Client pages</h1>
        <p className="mt-2 text-sm text-slate-600">
          Build tailored shortlists to share with each client.
        </p>
      </header>

      <AgentClientPagesClient
        initialPages={(pages as typeof pages) || []}
        agentSlug={profile?.agent_slug ?? ""}
        siteUrl={siteUrl}
        liveProperties={(properties as typeof properties) || []}
      />
    </div>
  );
}
