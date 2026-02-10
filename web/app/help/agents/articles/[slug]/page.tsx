import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HelpArticleRenderer } from "@/components/help/articles/HelpArticleRenderer";
import {
  canViewerAccessArticle,
  filterAgentHelpArticles,
  getAllHelpArticles,
  getHelpArticleBySlug,
} from "@/lib/help/articles";
import { resolveHelpViewerRole } from "@/lib/help/viewer";

export const dynamic = "force-dynamic";

export default async function AgentHelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, viewerRole, allArticles] = await Promise.all([
    getHelpArticleBySlug(slug),
    resolveHelpViewerRole(),
    getAllHelpArticles(),
  ]);

  if (!article) notFound();

  if (!canViewerAccessArticle(article.role, viewerRole)) {
    redirect("/forbidden?reason=role");
  }

  const curated = filterAgentHelpArticles(allArticles, viewerRole);
  const related = curated.filter((item) => item.slug !== article.slug).slice(0, 4);

  return (
    <div className="space-y-6" data-testid="help-agent-article-page">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Agent Help Centre</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{article.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{article.description}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{article.category}</span>
          <span>Updated {article.updatedAt}</span>
        </div>
      </header>

      <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <HelpArticleRenderer source={article.body} />
      </article>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Related articles</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {related.map((item) => (
            <Link
              key={item.slug}
              href={`/help/agents/articles/${item.slug}`}
              className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              {item.title}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
