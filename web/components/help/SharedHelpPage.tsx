import Link from "next/link";
import { HelpArticleRenderer } from "@/components/help/articles/HelpArticleRenderer";
import {
  HELP_SHARED_LABELS,
  getSharedHelpDocBySlug,
  getSharedHelpDocPath,
  getSharedHelpDocs,
  type HelpSharedSection,
} from "@/lib/help/docs";

export async function SharedHelpIndex({
  section,
  subtitle,
}: {
  section: HelpSharedSection;
  subtitle?: string;
}) {
  const docs = await getSharedHelpDocs(section);
  const label = HELP_SHARED_LABELS[section];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6" data-testid={`help-${section}-landing`}>
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Shared Help</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{label}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {subtitle || `Cross-role guidance for ${label.toLowerCase()} workflows.`}
        </p>
      </header>

      <section className="grid gap-3">
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={getSharedHelpDocPath(section, doc.slug)}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          >
            <h2 className="text-lg font-semibold text-slate-900">{doc.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{doc.description}</p>
            <p className="mt-3 text-xs text-slate-500">Last updated {doc.updatedAt}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

export async function SharedHelpDetail({
  section,
  slug,
}: {
  section: HelpSharedSection;
  slug: string;
}) {
  const doc = await getSharedHelpDocBySlug(section, slug);
  if (!doc) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6" data-testid={`help-${section}-${slug}`}>
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Shared guide</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{doc.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{doc.description}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>Last updated {doc.updatedAt}</span>
          <span>•</span>
          <Link href={`/help/${section}`} className="font-semibold text-slate-800 underline underline-offset-4">
            Back to {HELP_SHARED_LABELS[section]}
          </Link>
        </div>
      </header>

      <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <HelpArticleRenderer source={doc.body} />
      </article>
    </div>
  );
}
