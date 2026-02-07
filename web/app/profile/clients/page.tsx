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
    .select("id, agent_slug, display_name, business_name, avatar_url, agent_bio")
    .eq("id", user.id)
    .maybeSingle();

  const { data: pages } = await supabase
    .from("agent_client_pages")
    .select(
      "id, client_name, client_slug, client_brief, client_requirements, title, agent_about, agent_company_name, agent_logo_url, banner_url, notes_md, criteria, pinned_property_ids, published, published_at, expires_at, updated_at"
    )
    .eq("agent_user_id", user.id)
    .order("updated_at", { ascending: false });

  const pageIds = (pages ?? []).map((page) => page.id);
  const { data: curatedRows } = pageIds.length
    ? await supabase
        .from("agent_client_page_listings")
        .select("client_page_id, property_id, rank, pinned")
        .in("client_page_id", pageIds)
    : { data: [] };

  const curatedByPage = (curatedRows ?? []).reduce<Record<string, typeof curatedRows>>((acc, row) => {
    const key = row.client_page_id as string;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

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
        initialPages={
          ((pages as typeof pages) || []).map((page) => ({
            ...page,
            curated_listings: curatedByPage[page.id] ?? [],
          }))
        }
        agentSlug={profile?.agent_slug ?? ""}
        siteUrl={siteUrl}
        liveProperties={(properties as typeof properties) || []}
        agentProfile={
          profile
            ? {
                display_name: profile.display_name ?? null,
                business_name: profile.business_name ?? null,
                avatar_url: profile.avatar_url ?? null,
                agent_bio: profile.agent_bio ?? null,
              }
            : null
        }
      />
    </div>
  );
}
