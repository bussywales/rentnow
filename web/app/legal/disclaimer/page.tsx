import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";
import { LEGAL_AUDIENCE_LABELS } from "@/lib/legal/constants";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function DisclaimerPage({ searchParams }: PageProps) {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Disclaimer unavailable</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured, so the disclaimer cannot be displayed.
        </p>
      </div>
    );
  }

  const jurisdiction = await resolveJurisdiction({ searchParams });
  const supabase = await createServerSupabaseClient();
  const nowIso = new Date().toISOString();
  const { data: disclaimer, error } = await supabase
    .from("legal_documents")
    .select("id, title, version, effective_at, content_md, status, published_at")
    .eq("jurisdiction", jurisdiction)
    .eq("audience", "DISCLAIMER")
    .eq("status", "published")
    .or(`effective_at.is.null,effective_at.lte.${nowIso}`)
    .order("version", { ascending: false })
    .maybeSingle();

  if (error || !disclaimer) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Disclaimer unavailable</h1>
        <p className="text-sm text-slate-600">
          Published disclaimer content is not available yet. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {LEGAL_AUDIENCE_LABELS.DISCLAIMER}
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {disclaimer.title}
        </h1>
        <p className="text-xs text-slate-500">
          Version {disclaimer.version}
          {disclaimer.effective_at
            ? ` • Effective ${new Date(disclaimer.effective_at).toLocaleDateString()}`
            : ""}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <LegalMarkdown content={disclaimer.content_md ?? ""} />
      </div>
    </div>
  );
}
