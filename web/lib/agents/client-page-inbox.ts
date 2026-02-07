export type ClientPageLeadAttribution = {
  client_page_id?: string | null;
};

export type ClientPageLeadRow = {
  id: string;
  lead_attributions?: ClientPageLeadAttribution[] | null;
};

export function filterLeadsByClientPage<T extends ClientPageLeadRow>(
  leads: T[],
  clientPageId: string
): T[] {
  if (!clientPageId) return [];
  return leads.filter((lead) =>
    (lead.lead_attributions ?? []).some(
      (attr) => attr?.client_page_id === clientPageId
    )
  );
}

export function canAccessClientPageInbox(input: {
  viewerId?: string | null;
  clientPageOwnerId?: string | null;
}): boolean {
  if (!input.viewerId || !input.clientPageOwnerId) return false;
  return input.viewerId === input.clientPageOwnerId;
}
