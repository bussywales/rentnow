import Link from "next/link";
import { getAllHelpArticles, filterHelpArticlesForViewer, resolveHelpArticleCategories } from "@/lib/help/articles";
import { resolveHelpViewerRole } from "@/lib/help/viewer";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function resolveValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default async function HelpArticlesIndexPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const query = resolveValue(params.q).trim().toLowerCase();
  const category = resolveValue(params.category).trim();

  const [viewerRole, allArticles] = await Promise.all([resolveHelpViewerRole(), getAllHelpArticles()]);
  const visible = filterHelpArticlesForViewer(allArticles, viewerRole);
  const categories = resolveHelpArticleCategories(visible);

  const filtered = visible.filter((article) => {
    const categoryMatch = !category || article.category === category;
    const queryMatch =
      !query ||
      article.title.toLowerCase().includes(query) ||
      article.description.toLowerCase().includes(query) ||
      article.tags.some((tag) => tag.toLowerCase().includes(query));
    return categoryMatch && queryMatch;
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8" data-testid="help-articles-index">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Help Articles</p>
        <h1 className="text-3xl font-semibold text-slate-900">Browse published guides</h1>
        <p className="text-sm text-slate-600">
          Search by keyword and category. Article visibility is role-aware.
        </p>
      </header>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_auto]">
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Search
          <input
            name="q"
            defaultValue={query}
            placeholder="referrals, listings, viewings"
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none ring-slate-200 focus:ring"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Category
          <select
            name="category"
            defaultValue={category}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none ring-slate-200 focus:ring"
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Apply
          </button>
          <Link
            href="/help/articles"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((article) => (
          <Link
            key={article.slug}
            href={`/help/articles/${article.slug}`}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                {article.category}
              </span>
              <span>Updated {article.updatedAt}</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">{article.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{article.description}</p>
            {article.tags.length ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {article.tags.map((tag) => (
                  <span key={`${article.slug}-${tag}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </Link>
        ))}
      </div>

      {!filtered.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          No articles matched your filters.
        </div>
      ) : null}
    </div>
  );
}
