import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { LegalAudience } from "@/lib/legal/constants";

export type PublicLegalDocument = {
  id: string;
  jurisdiction: string;
  audience: LegalAudience;
  version: number;
  status: string;
  title: string;
  effective_at?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type FetchPublishedDocs = (input: {
  jurisdiction: string;
  nowIso: string;
}) => Promise<{ data: PublicLegalDocument[] | null; error: { message: string } | null }>;

type GetPublicDocumentsInput = {
  jurisdiction: string;
  supabase?: SupabaseClient;
  fetchPublishedDocs?: FetchPublishedDocs;
};

async function defaultFetchPublishedDocs(
  supabase: SupabaseClient,
  jurisdiction: string,
  nowIso: string
) {
  const { data, error } = await supabase
    .from("legal_documents")
    .select(
      "id, jurisdiction, audience, version, status, title, effective_at, published_at, updated_at, created_at"
    )
    .eq("jurisdiction", jurisdiction)
    .eq("status", "published")
    .or(`effective_at.is.null,effective_at.lte.${nowIso}`)
    .order("audience", { ascending: true })
    .order("version", { ascending: false });

  return { data: (data as PublicLegalDocument[] | null) ?? null, error };
}

export async function getPublicLegalDocuments(
  input: GetPublicDocumentsInput
): Promise<PublicLegalDocument[]> {
  const nowIso = new Date().toISOString();
  if (input.fetchPublishedDocs) {
    const { data, error } = await input.fetchPublishedDocs({
      jurisdiction: input.jurisdiction,
      nowIso,
    });
    if (error || !data) return [];
    return latestPerAudience(data);
  }

  const supabase = input.supabase ?? (await createServerSupabaseClient());
  const { data, error } = await defaultFetchPublishedDocs(
    supabase,
    input.jurisdiction,
    nowIso
  );
  if (error || !data) return [];
  return latestPerAudience(data);
}

function latestPerAudience(docs: PublicLegalDocument[]) {
  const byAudience = new Map<LegalAudience, PublicLegalDocument>();
  docs.forEach((doc) => {
    const audience = doc.audience as LegalAudience;
    if (!byAudience.has(audience)) {
      byAudience.set(audience, doc);
    }
  });
  return Array.from(byAudience.values());
}
