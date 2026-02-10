import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import type { UserRole } from "@/lib/types";

export type HelpArticleRole = "public" | "agent" | "host" | "admin";

export type HelpArticle = {
  slug: string;
  title: string;
  description: string;
  role: HelpArticleRole;
  category: string;
  order: number;
  tags: string[];
  updatedAt: string;
  body: string;
};

const HELP_CONTENT_DIR = path.join(process.cwd(), "content", "help");

function normalizeRole(value: string): HelpArticleRole {
  const lower = value.trim().toLowerCase();
  if (lower === "agent" || lower === "host" || lower === "admin") {
    return lower;
  }
  return "public";
}

function parseListValue(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }
  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((item) => item.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }
  return [trimmed.replace(/^"|"$/g, "")];
}

function parseFrontmatter(raw: string): { meta: Record<string, string | string[]>; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }

  const frontmatter = match[1];
  const body = raw.slice(match[0].length).trim();
  const meta: Record<string, string | string[]> = {};

  for (const line of frontmatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf(":");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();

    if (key === "tags") {
      meta[key] = parseListValue(value);
      continue;
    }

    meta[key] = value.replace(/^"|"$/g, "");
  }

  return { meta, body };
}

function toArticle(slug: string, raw: string): HelpArticle {
  const { meta, body } = parseFrontmatter(raw);
  const title = typeof meta.title === "string" && meta.title ? meta.title : slug;
  const description =
    typeof meta.description === "string" && meta.description
      ? meta.description
      : "Help article";
  const role = normalizeRole(typeof meta.role === "string" ? meta.role : "public");
  const category =
    typeof meta.category === "string" && meta.category
      ? meta.category
      : "General";
  const orderRaw = typeof meta.order === "string" ? Number(meta.order) : Number.NaN;
  const order = Number.isFinite(orderRaw) ? Math.trunc(orderRaw) : 999;
  const tags = Array.isArray(meta.tags)
    ? meta.tags.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const updatedAt =
    typeof meta.updatedAt === "string" && meta.updatedAt
      ? meta.updatedAt
      : new Date().toISOString().slice(0, 10);

  return {
    slug,
    title,
    description,
    role,
    category,
    order,
    tags,
    updatedAt,
    body,
  };
}

function sortArticles(a: HelpArticle, b: HelpArticle): number {
  const category = a.category.localeCompare(b.category);
  if (category !== 0) return category;
  if (a.order !== b.order) return a.order - b.order;
  return a.title.localeCompare(b.title);
}

const loadHelpArticles = cache(async (): Promise<HelpArticle[]> => {
  let files: string[] = [];
  try {
    files = await fs.readdir(HELP_CONTENT_DIR);
  } catch {
    return [];
  }

  const articleFiles = files.filter((file) => file.endsWith(".mdx"));
  const entries = await Promise.all(
    articleFiles.map(async (file) => {
      const fullPath = path.join(HELP_CONTENT_DIR, file);
      const raw = await fs.readFile(fullPath, "utf8");
      return toArticle(file.replace(/\.mdx$/i, ""), raw);
    })
  );

  return entries.sort(sortArticles);
});

export async function getAllHelpArticles(): Promise<HelpArticle[]> {
  return loadHelpArticles();
}

export async function getHelpArticleBySlug(slug: string): Promise<HelpArticle | null> {
  const all = await loadHelpArticles();
  return all.find((article) => article.slug === slug) ?? null;
}

export function canViewerAccessArticle(articleRole: HelpArticleRole, viewerRole: UserRole | null): boolean {
  if (articleRole === "public") return true;
  if (articleRole === "admin") return viewerRole === "admin";
  if (articleRole === "agent") return viewerRole === "agent";
  if (articleRole === "host") return viewerRole === "agent" || viewerRole === "landlord";
  return false;
}

export function filterHelpArticlesForViewer(
  articles: HelpArticle[],
  viewerRole: UserRole | null
): HelpArticle[] {
  return articles.filter((article) => canViewerAccessArticle(article.role, viewerRole));
}

export function filterAgentHelpArticles(
  articles: HelpArticle[],
  viewerRole: UserRole | null
): HelpArticle[] {
  return articles.filter((article) => {
    if (article.role === "admin") return false;
    return canViewerAccessArticle(article.role, viewerRole);
  });
}

export function resolveHelpArticleCategories(articles: HelpArticle[]): string[] {
  return Array.from(new Set(articles.map((article) => article.category))).sort((a, b) =>
    a.localeCompare(b)
  );
}
