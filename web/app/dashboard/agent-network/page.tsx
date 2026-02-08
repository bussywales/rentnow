import { redirect } from "next/navigation";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";
import { isAgentNetworkDiscoveryEnabled } from "@/lib/agents/agent-network";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AgentNetworkDiscoveryClient from "@/components/agents/AgentNetworkDiscoveryClient";

export const dynamic = "force-dynamic";

export default async function AgentNetworkPage() {
  if (!hasServerSupabaseEnv()) {
    redirect("/forbidden");
  }

  const { user, role } = await resolveServerRole();
  if (!user) {
    redirect("/auth/login?reason=auth&redirect=/dashboard/agent-network");
  }
  if (role !== "agent") {
    redirect("/forbidden?reason=role");
  }

  const enabled = await isAgentNetworkDiscoveryEnabled();
  if (!enabled) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Agent network
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Agent Network Discovery is disabled
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Ask an admin to enable Agent Network Discovery in Settings.
        </p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: pages } = await supabase
    .from("agent_client_pages")
    .select("id, client_name, client_slug")
    .eq("agent_user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <AgentNetworkDiscoveryClient clientPages={(pages as typeof pages) || []} />
    </div>
  );
}
