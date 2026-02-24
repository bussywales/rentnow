const SUMMARY_MAX_LENGTH = 240;

const HEADING_ONLY_LABELS = new Set([
  "what changed",
  "whats changed",
  "what's changed",
  "why it matters",
  "who it affects",
  "summary",
  "changes",
  "update",
  "updates",
]);

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateSummary(value: string, maxLength = SUMMARY_MAX_LENGTH) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function stripInlineMarkdown(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

function stripLeadingMarkdownTokens(value: string) {
  return value
    .replace(/^>\s*/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^#{1,6}\s+/, "")
    .trim();
}

function normalizeHeadingLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9' ]+/g, "").replace(/\s+/g, " ").trim();
}

function isHeadingOnlyLabel(value: string) {
  return HEADING_ONLY_LABELS.has(normalizeHeadingLabel(value));
}

export function normalizeSummaryText(value: string) {
  const cleaned = normalizeWhitespace(stripInlineMarkdown(value));
  if (!cleaned) return "";
  return truncateSummary(cleaned);
}

function collectCandidateLines(paragraph: string) {
  const lines = paragraph
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates: string[] = [];

  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) continue;
    if (/^(```|~~~)/.test(line)) continue;

    const stripped = stripLeadingMarkdownTokens(stripInlineMarkdown(line));
    if (!stripped) continue;
    if (isHeadingOnlyLabel(stripped)) continue;
    candidates.push(stripped);
  }

  return candidates;
}

export function deriveSummaryFromMarkdownBody(body: string) {
  const raw = String(body || "").trim();
  if (!raw) return "";

  const paragraphs = raw.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);

  for (const paragraph of paragraphs) {
    const candidates = collectCandidateLines(paragraph);
    if (!candidates.length) continue;
    const summary = normalizeSummaryText(candidates[0] || "");
    if (summary) return summary;
  }

  return normalizeSummaryText(stripLeadingMarkdownTokens(stripInlineMarkdown(raw)));
}

export function isNonInformativeSummary(summary: string) {
  const cleaned = normalizeSummaryText(stripLeadingMarkdownTokens(summary));
  if (!cleaned) return true;
  if (isHeadingOnlyLabel(cleaned)) return true;
  if (/^#{1,6}\s+/.test(summary.trim())) return true;
  return false;
}

export function resolveProductUpdateSummary(summary: string | null | undefined, body?: string | null) {
  const rawSummary = String(summary || "");
  const normalizedSummary = normalizeSummaryText(stripLeadingMarkdownTokens(rawSummary));

  if (normalizedSummary && !isNonInformativeSummary(rawSummary)) {
    return normalizedSummary;
  }

  if (body) {
    const derived = deriveSummaryFromMarkdownBody(body);
    if (derived) return derived;
  }

  return normalizedSummary;
}
