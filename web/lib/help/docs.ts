import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import type { HelpNavSection } from "@/components/help/help-nav";
import type { UserRole } from "@/lib/types";

export const HELP_ROLES = ["tenant", "landlord", "agent", "admin"] as const;
export type HelpRole = (typeof HELP_ROLES)[number];

export const HELP_SHARED_SECTIONS = ["troubleshooting", "success"] as const;
export type HelpSharedSection = (typeof HELP_SHARED_SECTIONS)[number];

export const HELP_ROLE_LABELS: Record<HelpRole, string> = {
  tenant: "Tenant",
  landlord: "Landlord",
  agent: "Agent",
  admin: "Admin",
};

export const HELP_SHARED_LABELS: Record<HelpSharedSection, string> = {
  troubleshooting: "Troubleshooting",
  success: "Success",
};

export type HelpDoc = {
  role: HelpRole;
  slug: string;
  filename: string;
  title: string;
  description: string;
  order: number;
  updatedAt: string;
  sourcePath: string;
  body: string;
};

export type SharedHelpDoc = {
  section: HelpSharedSection;
  slug: string;
  filename: string;
  title: string;
  description: string;
  order: number;
  updatedAt: string;
  sourcePath: string;
  body: string;
};

const HELP_DOCS_ROOT = path.join(process.cwd(), "docs", "help");

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
  return [trimmed.replace(/^"|"$/g, "")];
}

function parseFrontmatter(raw: string): { meta: Record<string, string | string[]>; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }

  const meta: Record<string, string | string[]> = {};
  let currentKey: string | null = null;

  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- ") && currentKey) {
      const list = Array.isArray(meta[currentKey]) ? (meta[currentKey] as string[]) : [];
      list.push(trimmed.slice(2).trim().replace(/^"|"$/g, ""));
      meta[currentKey] = list;
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    currentKey = key;

    if (value.startsWith("[") && value.endsWith("]")) {
      meta[key] = parseListValue(value);
      continue;
    }
    if (value) {
      meta[key] = value.replace(/^"|"$/g, "");
      continue;
    }
    meta[key] = [];
  }

  return { meta, body: raw.slice(match[0].length).trim() };
}

function tryGetGitUpdatedDate(relativePathFromWebRoot: string): string {
  try {
    const output = execSync(`git log -1 --format=%cs -- "${relativePathFromWebRoot}"`, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });
    const date = output.trim();
    if (date) return date;
  } catch {
    // Ignore and fallback.
  }
  return new Date().toISOString().slice(0, 10);
}

function toBaseDoc(filename: string, raw: string, sourcePath: string) {
  const { meta, body } = parseFrontmatter(raw);
  const slug = filename.replace(/\.md$/i, "");
  const relativePath = path.relative(process.cwd(), sourcePath);

  const orderValue = Number(typeof meta.order === "string" ? meta.order : "");
  const updatedFromMeta =
    typeof meta.updated_at === "string"
      ? meta.updated_at
      : typeof meta.updatedAt === "string"
        ? meta.updatedAt
        : "";

  return {
    slug,
    filename,
    title: typeof meta.title === "string" && meta.title ? meta.title : slug,
    description:
      typeof meta.description === "string" && meta.description
        ? meta.description
        : "Help guidance",
    order: Number.isFinite(orderValue) ? Math.trunc(orderValue) : 999,
    updatedAt: updatedFromMeta || tryGetGitUpdatedDate(relativePath),
    sourcePath,
    body,
  };
}

async function readMarkdownDocsFromDir(dirPath: string) {
  const entries = await fs.readdir(dirPath).catch(() => []);
  const files = entries
    .filter((entry) => entry.endsWith(".md"))
    .filter((entry) => entry !== "README.md" && entry !== "_TEMPLATE.md")
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    files.map(async (filename) => {
      const fullPath = path.join(dirPath, filename);
      const raw = await fs.readFile(fullPath, "utf8");
      return toBaseDoc(filename, raw, fullPath);
    })
  );
}

const loadAllRoleDocs = cache(async (): Promise<Record<HelpRole, HelpDoc[]>> => {
  const result = {} as Record<HelpRole, HelpDoc[]>;

  for (const role of HELP_ROLES) {
    const roleDir = path.join(HELP_DOCS_ROOT, role);
    const docs = await readMarkdownDocsFromDir(roleDir);
    result[role] = docs
      .map((doc) => ({ ...doc, role }))
      .sort((a, b) => (a.order === b.order ? a.title.localeCompare(b.title) : a.order - b.order));
  }

  return result;
});

const loadAllSharedDocs = cache(async (): Promise<Record<HelpSharedSection, SharedHelpDoc[]>> => {
  const result = {} as Record<HelpSharedSection, SharedHelpDoc[]>;

  for (const section of HELP_SHARED_SECTIONS) {
    const sectionDir = path.join(HELP_DOCS_ROOT, section);
    const docs = await readMarkdownDocsFromDir(sectionDir);
    result[section] = docs
      .map((doc) => ({ ...doc, section }))
      .sort((a, b) => (a.order === b.order ? a.title.localeCompare(b.title) : a.order - b.order));
  }

  return result;
});

export async function getHelpDocsForRole(role: HelpRole): Promise<HelpDoc[]> {
  const all = await loadAllRoleDocs();
  return all[role] ?? [];
}

export async function getHelpDocByRoleAndSlug(role: HelpRole, slug: string): Promise<HelpDoc | null> {
  const docs = await getHelpDocsForRole(role);
  return docs.find((doc) => doc.slug === slug) ?? null;
}

export async function getSharedHelpDocs(section: HelpSharedSection): Promise<SharedHelpDoc[]> {
  const all = await loadAllSharedDocs();
  return all[section] ?? [];
}

export async function getSharedHelpDocBySlug(
  section: HelpSharedSection,
  slug: string
): Promise<SharedHelpDoc | null> {
  const docs = await getSharedHelpDocs(section);
  return docs.find((doc) => doc.slug === slug) ?? null;
}

export function getHelpRoleIndexPath(role: HelpRole) {
  return `/help/${role}`;
}

export function getHelpDocPath(role: HelpRole, slug: string) {
  return `/help/${role}/${slug}`;
}

export function getSharedHelpIndexPath(section: HelpSharedSection) {
  return `/help/${section}`;
}

export function getSharedHelpDocPath(section: HelpSharedSection, slug: string) {
  return `/help/${section}/${slug}`;
}

export async function buildHelpNavForRole(role: HelpRole): Promise<HelpNavSection[]> {
  const docs = await getHelpDocsForRole(role);
  const sections: HelpNavSection[] = [
    {
      title: `${HELP_ROLE_LABELS[role]} guides`,
      items: docs.map((doc) => ({
        label: doc.title,
        href: getHelpDocPath(role, doc.slug),
      })),
    },
    {
      title: "Shared",
      items: [
        { label: "Troubleshooting hub", href: "/help/troubleshooting" },
        { label: "Success hub", href: "/help/success" },
      ],
    },
  ];

  if (role === "admin") {
    sections.push({
      title: "Admin ops links",
      items: [
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Listings operations", href: "/help/admin/listings" },
        { label: "Product updates", href: "/help/admin/product-updates" },
      ],
    });
  }

  return sections;
}

export async function getTopHelpDocsForRole(role: HelpRole, limit = 3): Promise<HelpDoc[]> {
  const docs = await getHelpDocsForRole(role);
  return docs.slice(0, Math.max(1, limit));
}

export function resolvePreferredHelpRole(viewerRole: UserRole | null): HelpRole | null {
  if (!viewerRole) return null;
  if (viewerRole === "tenant") return "tenant";
  if (viewerRole === "landlord") return "landlord";
  if (viewerRole === "agent") return "agent";
  if (viewerRole === "admin") return "admin";
  return null;
}
