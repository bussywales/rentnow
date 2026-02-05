export type UpdateNoteAudience = "ADMIN" | "HOST" | "TENANT" | "AGENT";

export type ParsedUpdateNote = {
  title: string;
  audiences: UpdateNoteAudience[];
  areas: string[];
  cta_href?: string;
  published_at?: string;
  source_ref?: string;
  body: string;
  summary: string;
};

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

function parseListValue(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1);
    return inner
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [trimmed];
}

function normalizeAudience(value: string): UpdateNoteAudience | null {
  const upper = value.trim().toUpperCase();
  if (upper === "ADMIN" || upper === "HOST" || upper === "TENANT" || upper === "AGENT") {
    return upper as UpdateNoteAudience;
  }
  return null;
}

export function parseUpdateNote(raw: string): ParsedUpdateNote {
  const match = raw.match(FRONTMATTER_REGEX);
  if (!match) {
    throw new Error("Update note is missing frontmatter.");
  }

  const frontmatter = match[1];
  const body = raw.slice(match[0].length).trim();
  const lines = frontmatter.split("\n");
  const record: Record<string, string | string[]> = {};
  let currentKey: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("- ") && currentKey) {
      const value = trimmed.slice(2).trim();
      const list = Array.isArray(record[currentKey])
        ? (record[currentKey] as string[])
        : [];
      list.push(value);
      record[currentKey] = list;
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    currentKey = key;

    if (value.startsWith("[") || value.startsWith("-")) {
      record[key] = parseListValue(value);
    } else if (value) {
      record[key] = value.replace(/^"|"$/g, "");
    } else {
      record[key] = [];
    }
  }

  const title = typeof record.title === "string" ? record.title : "";
  if (!title) {
    throw new Error("Update note frontmatter must include title.");
  }

  const rawAudiences = Array.isArray(record.audiences)
    ? (record.audiences as string[])
    : typeof record.audiences === "string"
      ? parseListValue(record.audiences)
      : [];

  const audiences = rawAudiences
    .map(normalizeAudience)
    .filter((value): value is UpdateNoteAudience => !!value);

  const rawAreas = Array.isArray(record.areas)
    ? (record.areas as string[])
    : typeof record.areas === "string"
      ? parseListValue(record.areas)
      : [];

  const summary = buildSummaryFromBody(body);

  return {
    title,
    audiences,
    areas: rawAreas,
    cta_href: typeof record.cta_href === "string" ? record.cta_href : undefined,
    published_at: typeof record.published_at === "string" ? record.published_at : undefined,
    source_ref: typeof record.source_ref === "string" ? record.source_ref : undefined,
    body,
    summary,
  };
}

export function buildSummaryFromBody(body: string): string {
  if (!body) return "";
  const paragraphs = body.split(/\n\s*\n/).map((part) => part.trim());
  const first = paragraphs.find((part) => part.length > 0) || "";
  if (!first) return "";
  const normalized = first.replace(/\s+/g, " ").trim();
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

export function mapUpdateAudiencesToProductAudiences(audiences: UpdateNoteAudience[]) {
  const mapped = new Set<string>();
  for (const audience of audiences) {
    if (audience === "ADMIN") mapped.add("admin");
    if (audience === "TENANT") mapped.add("tenant");
    if (audience === "HOST") mapped.add("host");
    if (audience === "AGENT") mapped.add("host");
  }
  return Array.from(mapped);
}

export function resolveRequiredAudiencesFromPaths(paths: string[]): UpdateNoteAudience[] {
  const required = new Set<UpdateNoteAudience>();
  const matches = (path: string, prefix: string) => path.startsWith(prefix);

  for (const path of paths) {
    if (
      matches(path, "web/app/admin/") ||
      matches(path, "web/app/api/admin/") ||
      matches(path, "web/components/admin/") ||
      matches(path, "web/lib/admin/")
    ) {
      required.add("ADMIN");
    }
    if (
      matches(path, "web/app/host/") ||
      matches(path, "web/app/dashboard/") ||
      matches(path, "web/components/host/") ||
      matches(path, "web/components/leads/")
    ) {
      required.add("HOST");
    }
    if (
      matches(path, "web/app/tenant/") ||
      matches(path, "web/app/properties/") ||
      matches(path, "web/app/support/") ||
      matches(path, "web/components/tenant/") ||
      matches(path, "web/components/properties/") ||
      matches(path, "web/app/api/properties/") ||
      matches(path, "web/app/api/saved-properties/")
    ) {
      required.add("TENANT");
    }
    if (
      matches(path, "web/app/agents/") ||
      matches(path, "web/components/agents/") ||
      matches(path, "web/lib/agents/") ||
      matches(path, "web/app/api/profile/agent-storefront/")
    ) {
      required.add("AGENT");
    }
  }

  return Array.from(required);
}
