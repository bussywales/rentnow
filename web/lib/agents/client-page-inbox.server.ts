import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { filterLeadsByClientPage } from "@/lib/agents/client-page-inbox";
import type { LeadStatus } from "@/lib/leads/types";

export type ClientPageInboxFilters = {
  status?: LeadStatus | "all" | "offer" | null;
  dateRange?: "all" | "today" | "week" | "month";
  propertyId?: string | null;
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export type ClientPageInboxLead = {
  id: string;
  property_id: string;
  thread_id?: string | null;
  status: LeadStatus;
  intent?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  message?: string | null;
  buyer?: {
    id?: string | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  property?: {
    id?: string | null;
    title?: string | null;
    city?: string | null;
  } | null;
  lead_attributions?: { client_page_id?: string | null; source?: string | null }[] | null;
};

type RawLeadRow = {
  id?: string | null;
  property_id?: string | null;
  thread_id?: string | null;
  status?: string | null;
  intent?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  message?: string | null;
  buyer?: {
    id?: string | null;
    full_name?: string | null;
    display_name?: string | null;
    phone?: string | null;
  } | null;
  properties?: {
    id?: string | null;
    title?: string | null;
    city?: string | null;
  } | null;
  lead_attributions?: { client_page_id?: string | null; source?: string | null }[] | null;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizePage(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value || ""), 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return fallback;
}

function normalizePageSize(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value || ""), 10);
  if (Number.isFinite(parsed) && parsed > 0) return clampNumber(parsed, 10, 50);
  return fallback;
}

function resolveDateRange(range?: ClientPageInboxFilters["dateRange"]) {
  if (!range || range === "all") return null;
  const now = new Date();
  const start = new Date(now.getTime());
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  }
  return start.toISOString();
}

async function resolveBuyerEmails(buyerIds: string[]): Promise<Record<string, string>> {
  if (!hasServiceRoleEnv() || buyerIds.length === 0) return {};
  const adminClient = createServiceRoleClient();
  const unique = Array.from(new Set(buyerIds));
  const entries = await Promise.all(
    unique.map(async (id) => {
      try {
        const { data } = await adminClient.auth.admin.getUserById(id);
        const email = data?.user?.email;
        return email ? [id, email] : null;
      } catch {
        return null;
      }
    })
  );
  return entries.reduce<Record<string, string>>((acc, entry) => {
    if (!entry) return acc;
    acc[entry[0]] = entry[1];
    return acc;
  }, {});
}

export async function fetchClientPageLeads(input: {
  supabase: SupabaseClient;
  clientPageId: string;
  filters?: ClientPageInboxFilters;
  includeBuyerEmail?: boolean;
}): Promise<{
  leads: ClientPageInboxLead[];
  total: number;
  page: number;
  pageSize: number;
  error?: string | null;
}> {
  const page = normalizePage(input.filters?.page, 0);
  const pageSize = normalizePageSize(input.filters?.pageSize, 20);
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const startDate = resolveDateRange(input.filters?.dateRange);

  const db = input.supabase;
  let query = db
    .from("listing_leads")
    .select(
      `id, property_id, thread_id, status, intent, message, created_at, updated_at,
      buyer:profiles!listing_leads_buyer_id_fkey(id, full_name, display_name, phone),
      properties:properties(id, title, city),
      lead_attributions!inner(client_page_id, source)`,
      { count: "exact" }
    )
    .eq("lead_attributions.client_page_id", input.clientPageId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (input.filters?.unreadOnly) {
    query = query.eq("status", "NEW");
  } else if (input.filters?.status && input.filters.status !== "all") {
    const status = input.filters.status === "offer" ? "QUALIFIED" : input.filters.status;
    query = query.eq("status", status);
  }

  if (input.filters?.propertyId) {
    query = query.eq("property_id", input.filters.propertyId);
  }

  if (startDate) {
    query = query.gte("created_at", startDate);
  }

  const { data, error, count } = await query;
  if (error) {
    return { leads: [], total: 0, page, pageSize, error: error.message };
  }

  const filtered = filterLeadsByClientPage(
    (data as RawLeadRow[] | null) ?? [],
    input.clientPageId
  );

  const buyerIds = filtered
    .map((row) => row.buyer?.id)
    .filter((value): value is string => !!value);

  const emailMap = input.includeBuyerEmail ? await resolveBuyerEmails(buyerIds) : {};

  const leads: ClientPageInboxLead[] = filtered.map((row) => {
    const buyerId = row.buyer?.id ?? null;
    const buyerName = row.buyer?.display_name || row.buyer?.full_name || null;
    return {
      id: row.id ?? "",
      property_id: row.property_id ?? "",
      thread_id: row.thread_id ?? null,
      status: (row.status as LeadStatus) ?? "NEW",
      intent: row.intent ?? null,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
      message: row.message ?? null,
      buyer: row.buyer
        ? {
            id: buyerId,
            name: buyerName,
            phone: row.buyer?.phone ?? null,
            email: buyerId ? emailMap[buyerId] ?? null : null,
          }
        : null,
      property: row.properties
        ? {
            id: row.properties?.id ?? row.property_id ?? null,
            title: row.properties?.title ?? null,
            city: row.properties?.city ?? null,
          }
        : null,
      lead_attributions: row.lead_attributions ?? null,
    };
  });

  return {
    leads,
    total: typeof count === "number" ? count : leads.length,
    page,
    pageSize,
    error: null,
  };
}
