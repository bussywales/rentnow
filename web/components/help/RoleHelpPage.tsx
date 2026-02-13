import Link from "next/link";
import { HelpArticleRenderer } from "@/components/help/articles/HelpArticleRenderer";
import { HELP_ROLE_LABELS, getHelpDocByRoleAndSlug, getHelpDocPath, getHelpDocsForRole, type HelpRole } from "@/lib/help/docs";

export async function RoleHelpIndex(props: {
  role: HelpRole;
  title?: string;
  subtitle?: string;
}) {
  const docs = await getHelpDocsForRole(props.role);
  const label = HELP_ROLE_LABELS[props.role];
  const top = docs.slice(0, 3);

  return (
    <div className="space-y-6" data-testid={`help-${props.role}-landing`}>
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label} Help Centre</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          {props.title || `${label} playbook`}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {props.subtitle || `Actionable guides for ${label.toLowerCase()} workflows and troubleshooting.`}
        </p>
      </header>

      {top.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Top tasks</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {top.map((doc) => (
              <Link
                key={doc.slug}
                href={getHelpDocPath(props.role, doc.slug)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                {doc.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Using guided help</h2>
        <p className="mt-1 text-sm text-slate-600">
          Open contextual help from the header or page-level “Need help?” actions.
        </p>
        <div className="mt-3">
          <Link
            href="/help/troubleshooting/using-help-drawer"
            className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Read: Using the help drawer
          </Link>
        </div>
      </section>

      <section className="grid gap-3">
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={getHelpDocPath(props.role, doc.slug)}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Guide</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">{doc.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{doc.description}</p>
            <p className="mt-3 text-xs text-slate-500">Last updated {doc.updatedAt}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

export async function RoleHelpDetail(props: { role: HelpRole; slug: string }) {
  const doc = await getHelpDocByRoleAndSlug(props.role, props.slug);
  if (!doc) return null;
  const docs = await getHelpDocsForRole(props.role);
  const related = docs.filter((item) => item.slug !== doc.slug).slice(0, 4);

  return (
    <div className="space-y-6" data-testid={`help-${props.role}-${doc.slug}`}>
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{HELP_ROLE_LABELS[props.role]} guide</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{doc.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{doc.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Last updated {doc.updatedAt}</span>
          <span>•</span>
          <Link href={`/help/${props.role}`} className="font-semibold text-slate-800 underline underline-offset-4">
            Back to {HELP_ROLE_LABELS[props.role]} Help
          </Link>
        </div>
      </header>

      <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <HelpArticleRenderer source={doc.body} />
      </article>

      {related.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Related guides</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={getHelpDocPath(props.role, item.slug)}
                className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                {item.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
