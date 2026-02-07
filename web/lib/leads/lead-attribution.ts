import { isClientPagePublished } from "@/lib/agents/client-pages";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export type ClientPageAttributionCandidate = {
  id: string;
  agent_user_id: string;
  published?: boolean | null;
  expires_at?: string | null;
};

export type LeadAttributionInsert = {
  lead_id: string;
  agent_user_id: string;
  client_page_id: string;
  source: string;
};

export function canAttributeLeadToClientPage(input: {
  clientPage: ClientPageAttributionCandidate | null;
  propertyOwnerId: string;
}): boolean {
  if (!input.clientPage) return false;
  if (input.clientPage.agent_user_id !== input.propertyOwnerId) return false;
  return isClientPagePublished({
    published: input.clientPage.published,
    expiresAt: input.clientPage.expires_at,
  });
}

export async function insertLeadAttribution(
  adminClient: UntypedAdminClient,
  payload: LeadAttributionInsert
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await adminClient
    .from("lead_attributions")
    .insert(payload as Record<string, unknown>);
  if (error) {
    return { ok: false, error: error.message || "Unable to attribute lead." };
  }
  return { ok: true };
}
