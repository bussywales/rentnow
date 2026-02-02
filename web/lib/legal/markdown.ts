export type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const headingPattern = /^(#{1,6})\s+(.*)$/;
const unorderedListPattern = /^[-*+]\s+(.*)$/;
const orderedListPattern = /^\d+\.\s+(.*)$/;

function normalizeInline(text: string): string {
  let next = text;
  next = next.replace(/\[(.+?)\]\((.+?)\)/g, "$1");
  next = next.replace(/`([^`]+)`/g, "$1");
  next = next.replace(/\*\*(.+?)\*\*/g, "$1");
  next = next.replace(/__(.+?)__/g, "$1");
  next = next.replace(/\*(.+?)\*/g, "$1");
  next = next.replace(/_(.+?)_/g, "$1");
  return next.trim();
}

function pushParagraph(blocks: MarkdownBlock[], lines: string[]) {
  if (!lines.length) return;
  const text = normalizeInline(lines.join(" ").trim());
  if (text.length > 0) {
    blocks.push({ type: "paragraph", text });
  }
  lines.length = 0;
}

function pushList(blocks: MarkdownBlock[], items: string[]) {
  if (!items.length) return;
  const normalized = items.map((item) => normalizeInline(item)).filter(Boolean);
  if (normalized.length > 0) {
    blocks.push({ type: "list", items: normalized });
  }
  items.length = 0;
}

export function parseMarkdownToBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const paragraphLines: string[] = [];
  const listItems: string[] = [];

  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      pushParagraph(blocks, paragraphLines);
      pushList(blocks, listItems);
      continue;
    }

    const headingMatch = trimmed.match(headingPattern);
    if (headingMatch) {
      pushParagraph(blocks, paragraphLines);
      pushList(blocks, listItems);
      const level = Math.min(6, headingMatch[1].length);
      const text = normalizeInline(headingMatch[2]);
      if (text) {
        blocks.push({ type: "heading", level, text });
      }
      continue;
    }

    const listMatch = trimmed.match(unorderedListPattern) || trimmed.match(orderedListPattern);
    if (listMatch) {
      pushParagraph(blocks, paragraphLines);
      listItems.push(listMatch[1]);
      continue;
    }

    if (listItems.length) {
      pushList(blocks, listItems);
    }
    paragraphLines.push(trimmed);
  }

  pushParagraph(blocks, paragraphLines);
  pushList(blocks, listItems);

  return blocks;
}

export function isLegalContentEmpty(content: string | null | undefined): boolean {
  return !content || content.trim().length === 0;
}
