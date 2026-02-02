import Link from "next/link";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";
import { getPublicLegalDocuments } from "@/lib/legal/public-documents.server";
import { LEGAL_AUDIENCE_LABELS } from "@/lib/legal/constants";
import { buildPublicLegalExportLinks } from "@/lib/legal/export-links";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function LegalPage({ searchParams }: PageProps) {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Legal documents</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured, so legal documents are unavailable.
        </p>
      </div>
    );
  }

  const jurisdiction = await resolveJurisdiction({ searchParams });
  const documents = await getPublicLegalDocuments({ jurisdiction });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Legal documents</h1>
        <p className="text-sm text-slate-600">
          Latest published terms for jurisdiction {jurisdiction}.
        </p>
        <p className="text-xs text-slate-500">
          Need another country? Try{" "}
          <Link
            href="/legal?jurisdiction=NG"
            className="font-semibold text-slate-700 underline"
          >
            ?jurisdiction=NG
          </Link>
          .
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Published legal documents are not available yet. Please check back later.
        </div>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => {
            const effectiveLabel = doc.effective_at
              ? new Date(doc.effective_at).toLocaleDateString()
              : "Effective immediately";
            const { pdfView, pdfDownload, docxDownload } =
              buildPublicLegalExportLinks(doc.id);
            return (
              <section
                key={doc.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {LEGAL_AUDIENCE_LABELS[doc.audience]}
                  </p>
                  <h2 className="text-lg font-semibold text-slate-900">{doc.title}</h2>
                  <p className="text-xs text-slate-500">
                    Version {doc.version} • {effectiveLabel}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <a
                    href={pdfView}
                    className="rounded-full border border-slate-200 px-3 py-1 text-slate-700"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View PDF
                  </a>
                  <a
                    href={pdfDownload}
                    className="rounded-full border border-slate-200 px-3 py-1 text-slate-700"
                  >
                    Download PDF
                  </a>
                  <a
                    href={docxDownload}
                    className="rounded-full border border-slate-200 px-3 py-1 text-slate-700"
                  >
                    Download DOCX
                  </a>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
