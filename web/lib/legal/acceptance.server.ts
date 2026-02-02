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
  roles: UserRole[];
  requiredAudiences: LegalAudience[];
  documents: LegalDocumentSummary[];
  acceptedAudiences: LegalAudience[];
  pendingAudiences: LegalAudience[];
  missingAudiences: LegalAudience[];
  isComplete: boolean;
};

export async function getLegalAcceptanceStatus(input: {
  userId: string;
  role: UserRole | UserRole[] | null;
  jurisdiction?: string | null;
  supabase?: SupabaseClient;
}): Promise<LegalAcceptanceStatus> {
  const jurisdiction = input.jurisdiction || DEFAULT_JURISDICTION;
  const roles = Array.isArray(input.role) ? input.role : input.role ? [input.role] : [];
  const role = roles[0] ?? (input.role && !Array.isArray(input.role) ? input.role : null);
  const requiredAudiences = getRequiredLegalAudiences(input.role);
  const supabase = input.supabase ?? (await createServerSupabaseClient());
  const now = new Date().toISOString();

  const { data: docs, error: docsError } = await supabase
    .from("legal_documents")
    .select(
      "id, jurisdiction, audience, version, status, title, content_md, effective_at, published_at, updated_at, created_at"
    )
    .eq("jurisdiction", jurisdiction)
    .eq("status", "published")
    .lte("effective_at", now)
    .in("audience", requiredAudiences)
    .order("version", { ascending: false });

  if (docsError) {
    return {
      jurisdiction,
      role,
      roles,
      requiredAudiences,
      documents: [],
      acceptedAudiences: [],
      pendingAudiences: requiredAudiences,
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
    const audience = doc.audience as LegalAudience;
    if (!docsByAudience.has(audience)) {
      docsByAudience.set(audience, doc as LegalDocumentSummary);
    }
  });

  const documents: LegalDocumentSummary[] = [];
  const acceptedAudiences: LegalAudience[] = [];
  const pendingAudiences: LegalAudience[] = [];
  const missingAudiences: LegalAudience[] = [];

  requiredAudiences.forEach((audience) => {
    const doc = docsByAudience.get(audience);
    if (doc) {
      documents.push(doc);
      if (acceptanceSet.has(`${audience}:${doc.version}`)) {
        acceptedAudiences.push(audience);
      } else {
        pendingAudiences.push(audience);
      }
    } else {
      missingAudiences.push(audience);
    }
  });

  return {
    jurisdiction,
    role,
    roles,
    requiredAudiences,
    documents,
    acceptedAudiences,
    pendingAudiences,
    missingAudiences,
    isComplete: missingAudiences.length === 0 && pendingAudiences.length === 0,
  };
}
