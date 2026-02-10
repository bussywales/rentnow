import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HelpArticleRenderer } from "@/components/help/articles/HelpArticleRenderer";
import { canViewerAccessArticle, getHelpArticleBySlug } from "@/lib/help/articles";
import { resolveHelpViewerRole } from "@/lib/help/viewer";

export const dynamic = "force-dynamic";

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getHelpArticleBySlug(slug);
  if (!article) notFound();

  const viewerRole = await resolveHelpViewerRole();
  if (!canViewerAccessArticle(article.role, viewerRole)) {
    if (!viewerRole) {
      redirect(`/auth/required?redirect=${encodeURIComponent(`/help/articles/${slug}`)}&reason=auth`);
    }
    redirect("/forbidden?reason=role");
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8" data-testid="help-article-page">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Help article</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{article.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{article.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{article.category}</span>
          <span>Updated {article.updatedAt}</span>
        </div>
      </header>

      <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <HelpArticleRenderer source={article.body} />
      </article>

      <footer className="flex flex-wrap gap-3 text-sm">
        <Link href="/help/articles" className="font-semibold text-slate-900 underline underline-offset-4">
          Browse all articles
        </Link>
        <Link href="/help/agents" className="font-semibold text-slate-900 underline underline-offset-4">
          Agent Help Centre
        </Link>
        <Link href="/help/referrals" className="font-semibold text-slate-900 underline underline-offset-4">
          Referral FAQ
        </Link>
      </footer>
    </div>
  );
}
