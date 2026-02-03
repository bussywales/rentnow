import { redirect } from "next/navigation";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";
import { getLegalAcceptanceStatus } from "@/lib/legal/acceptance.server";
import { LEGAL_AUDIENCE_LABELS } from "@/lib/legal/constants";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";
import { LegalAcceptanceForm } from "@/components/legal/LegalAcceptanceForm";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function normalizeRedirect(value?: string | string[] | undefined, fallback = "/dashboard") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  return trimmed;
}

function defaultRedirect(role: UserRole | null) {
  if (role === "tenant") return "/tenant/home";
  if (role === "admin") return "/admin";
  return "/dashboard";
}

export default async function LegalAcceptPage({ searchParams }: PageProps) {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Terms unavailable</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured, so terms cannot be displayed.
        </p>
      </div>
    );
  }

  const redirectParam = normalizeRedirect(searchParams?.redirect, "/dashboard");
  const { supabase, user, role } = await resolveServerRole();

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/legal/accept?redirect=${redirectParam}`)}`);
  }

  if (!role) {
    redirect("/onboarding");
  }

  const jurisdiction = await resolveJurisdiction({
    searchParams,
    userId: user.id,
    supabase,
  });

  const status = await getLegalAcceptanceStatus({
    userId: user.id,
    role,
    jurisdiction,
    supabase,
  });

  if (status.isComplete) {
    redirect(redirectParam || defaultRedirect(role));
  }

  if (status.documents.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Terms unavailable</h1>
        <p className="text-sm text-slate-600">
          Published terms are not available yet. Please contact support.
        </p>
      </div>
    );
  }

  const missingDocs = status.missingAudiences;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Review terms & policies</h1>
        <p className="text-sm text-slate-600">
          You must accept the latest terms for your role before continuing.
        </p>
        {missingDocs.length > 0 && (
          <p className="text-sm text-rose-600">
            Missing published terms: {missingDocs.join(", ")}.
          </p>
        )}
      </div>
      <div className="space-y-6">
        {status.documents.map((doc) => (
          <section key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {LEGAL_AUDIENCE_LABELS[doc.audience]}
              </p>
              <h2 className="text-lg font-semibold text-slate-900">{doc.title}</h2>
              <p className="text-xs text-slate-500">
                Version {doc.version}
                {doc.effective_at ? ` • Effective ${new Date(doc.effective_at).toLocaleDateString()}` : ""}
              </p>
            </div>
            <div className="mt-4">
              <LegalMarkdown content={doc.content_md} />
            </div>
          </section>
        ))}
      </div>
      <LegalAcceptanceForm jurisdiction={jurisdiction} redirectTo={redirectParam} />
    </div>
  );
}
