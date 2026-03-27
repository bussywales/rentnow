import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/env";
import {
  HELP_ROLE_LABELS,
  getHelpDocByRoleAndSlug,
  getHelpDocPath,
  type HelpDoc,
  type HelpRole,
} from "@/lib/help/docs";

export function buildHelpDocMetadata(input: {
  role: HelpRole;
  slug: string;
  doc: HelpDoc | null;
  baseUrl: string | null;
}): Metadata {
  if (!input.doc) {
    return {
      title: `${HELP_ROLE_LABELS[input.role]} Help · PropatyHub`,
      robots: { index: false, follow: false },
    };
  }

  const isPublic = input.role !== "admin";
  const pagePath = getHelpDocPath(input.role, input.slug);
  const canonicalUrl = input.baseUrl ? `${input.baseUrl}${pagePath}` : pagePath;
  const title = isPublic
    ? input.doc.seoTitle || `${input.doc.title} · PropatyHub`
    : `${input.doc.title} · Admin Help · PropatyHub`;
  const description = input.doc.metaDescription || input.doc.description;

  if (!isPublic) {
    return {
      title,
      description,
      robots: {
        index: false,
        follow: false,
        nocache: true,
      },
    };
  }

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export async function getHelpDocMetadata(role: HelpRole, slug: string): Promise<Metadata> {
  const [doc, baseUrl] = await Promise.all([
    getHelpDocByRoleAndSlug(role, slug),
    getSiteUrl({ allowFallback: true }),
  ]);

  return buildHelpDocMetadata({
    role,
    slug,
    doc,
    baseUrl: baseUrl || null,
  });
}
