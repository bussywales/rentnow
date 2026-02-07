import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";
import { canAccessClientPageInbox } from "@/lib/agents/client-page-inbox";
import { fetchClientPageLeads } from "@/lib/agents/client-page-inbox.server";
import ClientPageInboxClient from "@/components/agents/ClientPageInboxClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id?: string } | Promise<{ id?: string }>;
};

export default async function ClientPageInboxPage({ params }: PageProps) {
  if (!hasServerSupabaseEnv()) {
    redirect("/forbidden");
  }

  const resolvedParams = await params;
  const clientPageId = resolvedParams?.id;
  if (!clientPageId) {
    notFound();
  }

  const { user, role } = await resolveServerRole();
  if (!user) {
    redirect(`/auth/login?reason=auth&redirect=/profile/clients/${clientPageId}/inbox`);
  }
  if (role !== "agent") {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: page } = await supabase
    .from("agent_client_pages")
    .select("id, agent_user_id, client_name, client_requirements, client_slug")
    .eq("id", clientPageId)
    .maybeSingle();

  if (!page || !canAccessClientPageInbox({ viewerId: user.id, clientPageOwnerId: page.agent_user_id })) {
    notFound();
  }

  const leadsResult = await fetchClientPageLeads({
    supabase,
    clientPageId: page.id,
    filters: { page: 0, pageSize: 20 },
    includeBuyerEmail: true,
  });

  return (
    <ClientPageInboxClient
      clientPage={{
        id: page.id,
        name: page.client_name ?? "Client",
        requirements: page.client_requirements ?? null,
        slug: page.client_slug ?? "",
      }}
      initialLeads={leadsResult.leads}
      initialTotal={leadsResult.total}
      initialPageSize={leadsResult.pageSize}
    />
  );
}
