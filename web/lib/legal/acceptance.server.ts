import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import { DEFAULT_JURISDICTION, type LegalAudience } from "@/lib/legal/constants";
import { getRequiredLegalAudiences } from "@/lib/legal/requirements";

if (typeof window !== "undefined") {
  throw new Error("Legal acceptance helpers are server-only.");
}

export type LegalDocumentSummary = {
  id: string;
  jurisdiction: string;
  audience: LegalAudience;
  version: number;
  status: string;
  title: string;
  content_md: string;
  effective_at?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type LegalAcceptanceStatus = {
  jurisdiction: string;
  role: UserRole | null;
  requiredAudiences: LegalAudience[];
  documents: LegalDocumentSummary[];
  acceptedAudiences: LegalAudience[];
  missingAudiences: LegalAudience[];
  isComplete: boolean;
};

export async function getLegalAcceptanceStatus(input: {
  userId: string;
  role: UserRole | null;
  jurisdiction?: string | null;
  supabase?: SupabaseClient;
}): Promise<LegalAcceptanceStatus> {
  const jurisdiction = input.jurisdiction || DEFAULT_JURISDICTION;
  const role = input.role;
  const requiredAudiences = getRequiredLegalAudiences(role);
  const supabase = input.supabase ?? (await createServerSupabaseClient());

  const { data: docs, error: docsError } = await supabase
    .from("legal_documents")
    .select(
      "id, jurisdiction, audience, version, status, title, content_md, effective_at, published_at, updated_at, created_at"
    )
    .eq("jurisdiction", jurisdiction)
    .eq("status", "published")
    .in("audience", requiredAudiences);

  if (docsError) {
    return {
      jurisdiction,
      role,
      requiredAudiences,
      documents: [],
      acceptedAudiences: [],
      missingAudiences: requiredAudiences,
      isComplete: false,
    };
  }

  const { data: acceptances } = await supabase
    .from("legal_acceptances")
    .select("audience, version, document_id")
    .eq("user_id", input.userId)
    .eq("jurisdiction", jurisdiction)
    .in("audience", requiredAudiences);

  const acceptanceSet = new Set(
    (acceptances || []).map((row) => `${row.audience}:${row.version}`)
  );
  const docsByAudience = new Map<LegalAudience, LegalDocumentSummary>();
  (docs || []).forEach((doc) => {
    docsByAudience.set(doc.audience as LegalAudience, doc as LegalDocumentSummary);
  });

  const documents: LegalDocumentSummary[] = [];
  const acceptedAudiences: LegalAudience[] = [];
  const missingAudiences: LegalAudience[] = [];

  requiredAudiences.forEach((audience) => {
    const doc = docsByAudience.get(audience);
    if (doc) {
      documents.push(doc);
      if (acceptanceSet.has(`${audience}:${doc.version}`)) {
        acceptedAudiences.push(audience);
      } else {
        missingAudiences.push(audience);
      }
    } else {
      missingAudiences.push(audience);
    }
  });

  return {
    jurisdiction,
    role,
    requiredAudiences,
    documents,
    acceptedAudiences,
    missingAudiences,
    isComplete: missingAudiences.length === 0,
  };
}
