import {
  HELP_SHARED_SECTIONS,
  HELP_ROLE_LABELS,
  HELP_SHARED_LABELS,
  getHelpDocsForRole,
  getSharedHelpDocs,
  type HelpRole,
  type HelpSharedSection,
} from "@/lib/help/docs";
import { PUBLIC_HELP_ROLES } from "@/lib/help/visibility";
import { SUPPORT_FAQ_ITEMS } from "@/lib/support/support-content";

type IndexedDoc = {
  id: string;
  title: string;
  description: string;
  body: string;
  href: string;
  label: string;
};

export type SupportHelpSearchResult = {
  title: string;
  snippet: string;
  href: string;
  score: number;
};

let docsCache: Promise<IndexedDoc[]> | null = null;

function tokenize(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function toSnippet(source: string, tokens: string[]) {
  const normalized = source.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const lower = normalized.toLowerCase();

  let bestStart = 0;
  for (const token of tokens) {
    const index = lower.indexOf(token);
    if (index >= 0) {
      bestStart = Math.max(0, index - 48);
      break;
    }
  }

  const excerpt = normalized.slice(bestStart, bestStart + 180).trim();
  return excerpt.length < normalized.length ? `${excerpt}…` : excerpt;
}

function scoreDoc(doc: IndexedDoc, query: string, tokens: string[]) {
  const title = doc.title.toLowerCase();
  const description = doc.description.toLowerCase();
  const body = doc.body.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let score = 0;

  if (title.includes(normalizedQuery)) score += 8;
  if (description.includes(normalizedQuery)) score += 5;
  if (body.includes(normalizedQuery)) score += 2;

  for (const token of tokens) {
    if (title.includes(token)) score += 3;
    if (description.includes(token)) score += 2;
    if (body.includes(token)) score += 1;
  }

  return score;
}

async function loadIndexedDocs(): Promise<IndexedDoc[]> {
  const roleDocs = await Promise.all(
    PUBLIC_HELP_ROLES.map(async (role: HelpRole) => {
      const docs = await getHelpDocsForRole(role);
      return docs.map((doc) => ({
        id: `${role}:${doc.slug}`,
        title: doc.title,
        description: doc.description,
        body: doc.body,
        href: `/help/${role}/${doc.slug}`,
        label: `${HELP_ROLE_LABELS[role]} guide`,
      }));
    })
  );

  const sharedDocs = await Promise.all(
    HELP_SHARED_SECTIONS.map(async (section: HelpSharedSection) => {
      const docs = await getSharedHelpDocs(section);
      return docs.map((doc) => ({
        id: `${section}:${doc.slug}`,
        title: doc.title,
        description: doc.description,
        body: doc.body,
        href: `/help/${section}/${doc.slug}`,
        label: `${HELP_SHARED_LABELS[section]} guide`,
      }));
    })
  );

  const supportFaqDocs = SUPPORT_FAQ_ITEMS.map((item) => ({
    id: `support-faq:${item.id}`,
    title: item.question,
    description: "Support FAQ",
    body: item.answer,
    href: "/support",
    label: "Support FAQ",
  }));

  return [...roleDocs.flat(), ...sharedDocs.flat(), ...supportFaqDocs];
}

export async function getSupportHelpIndexForTest(): Promise<Array<{ id: string; href: string; label: string }>> {
  if (!docsCache) {
    docsCache = loadIndexedDocs();
  }
  const docs = await docsCache;
  return docs.map((doc) => ({ id: doc.id, href: doc.href, label: doc.label }));
}

export function resetSupportHelpIndexForTest() {
  docsCache = null;
}

export async function searchSupportHelpDocs(
  query: string,
  limit = 6
): Promise<SupportHelpSearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];
  const tokens = tokenize(trimmedQuery);
  if (!tokens.length) return [];

  if (!docsCache) {
    docsCache = loadIndexedDocs();
  }
  const docs = await docsCache;

  return docs
    .map((doc) => {
      const score = scoreDoc(doc, trimmedQuery, tokens);
      return {
        title: doc.title,
        snippet: toSnippet(`${doc.description} ${doc.body}`, tokens),
        href: doc.href,
        score,
        label: doc.label,
      };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => (b.score === a.score ? a.title.localeCompare(b.title) : b.score - a.score))
    .slice(0, Math.max(1, limit))
    .map((doc) => ({
      title: doc.title,
      snippet: doc.snippet ? `${doc.snippet} (${doc.label})` : doc.label,
      href: doc.href,
      score: doc.score,
    }));
}
