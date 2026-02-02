import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  PDFDocument,
  PageSizes,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { parseMarkdownToBlocks, isLegalContentEmpty } from "@/lib/legal/markdown";
import type { LegalAudience } from "@/lib/legal/constants";

if (typeof window !== "undefined") {
  throw new Error("Legal export helpers are server-only.");
}

export type LegalExportInput = {
  title: string;
  version: number;
  jurisdiction: string;
  audience: LegalAudience;
  effective_at?: string | null;
  content_md: string;
};

function formatEffectiveDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const PAGE_MARGIN = 50;
const BODY_FONT_SIZE = 11;
const LINE_HEIGHT_FACTOR = 1.25;

type PdfSanitizeStats = {
  replacedCount: number;
  replacedChars: Set<string>;
};

function sanitizeMarkdownForPdf(markdown: string): string {
  return markdown.replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)");
}

function sanitizePdfText(
  text: string,
  font: PDFFont,
  stats: PdfSanitizeStats,
  cache: Map<string, boolean>
): string {
  let next = text;

  const replaceAndCount = (pattern: RegExp, replacement: string) => {
    let replaced = 0;
    next = next.replace(pattern, (match) => {
      replaced += 1;
      stats.replacedChars.add(match);
      return replacement;
    });
    stats.replacedCount += replaced;
  };

  replaceAndCount(/[⸻—–―−]/g, "-");
  replaceAndCount(/[“”]/g, "\"");
  replaceAndCount(/[‘’]/g, "'");
  replaceAndCount(/[•‣]/g, "-");
  replaceAndCount(/…/g, "...");
  replaceAndCount(/\u00A0/g, " ");

  if (!next) return next;

  let output = "";
  for (const char of next) {
    if (char === "\n" || char === "\r") {
      output += char;
      continue;
    }
    const cached = cache.get(char);
    let encodable = cached;
    if (encodable === undefined) {
      try {
        font.encodeText(char);
        encodable = true;
      } catch {
        encodable = false;
      }
      cache.set(char, encodable);
    }

    if (encodable) {
      output += char;
    } else {
      stats.replacedCount += 1;
      stats.replacedChars.add(char);
      output += "?";
    }
  }

  return output;
}

function breakLongWord(
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const segments: string[] = [];
  let current = "";

  for (const char of word) {
    const next = current + char;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || current.length === 0) {
      current = next;
      continue;
    }
    segments.push(current);
    current = char;
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
      } else {
        lines.push(...breakLongWord(word, font, size, maxWidth));
      }
      continue;
    }

    const candidate = `${line} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }

    lines.push(line);

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
    } else {
      const segments = breakLongWord(word, font, size, maxWidth);
      lines.push(...segments.slice(0, -1));
      line = segments[segments.length - 1] ?? "";
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

type PdfLayoutState = {
  page: PDFPage;
  cursorY: number;
};

function addPage(doc: PDFDocument): PdfLayoutState {
  const page = doc.addPage(PageSizes.A4);
  return { page, cursorY: page.getHeight() - PAGE_MARGIN };
}

function ensureSpace(
  doc: PDFDocument,
  state: PdfLayoutState,
  requiredHeight: number
): PdfLayoutState {
  if (state.cursorY - requiredHeight < PAGE_MARGIN) {
    return addPage(doc);
  }
  return state;
}

function drawLine(
  doc: PDFDocument,
  state: PdfLayoutState,
  text: string,
  font: PDFFont,
  size: number,
  x: number
): PdfLayoutState {
  const nextState = ensureSpace(doc, state, size);
  nextState.page.drawText(text, {
    x,
    y: nextState.cursorY - size,
    size,
    font,
    color: rgb(0, 0, 0),
  });
  nextState.cursorY -= size * LINE_HEIGHT_FACTOR;
  return nextState;
}

function drawCenteredLine(
  doc: PDFDocument,
  state: PdfLayoutState,
  text: string,
  font: PDFFont,
  size: number
): PdfLayoutState {
  const pageWidth = state.page.getWidth();
  const textWidth = font.widthOfTextAtSize(text, size);
  const x = Math.max(PAGE_MARGIN, (pageWidth - textWidth) / 2);
  return drawLine(doc, state, text, font, size, x);
}

function drawParagraph(
  doc: PDFDocument,
  state: PdfLayoutState,
  text: string,
  font: PDFFont,
  size: number,
  indent = 0
): PdfLayoutState {
  const pageWidth = state.page.getWidth();
  const maxWidth = pageWidth - PAGE_MARGIN * 2 - indent;
  const lines = wrapText(text, font, size, maxWidth);
  let nextState = state;

  for (const line of lines) {
    nextState = drawLine(doc, nextState, line, font, size, PAGE_MARGIN + indent);
  }

  nextState.cursorY -= size * 0.4;
  return nextState;
}

export async function renderLegalPdf(input: LegalExportInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const sanitizeStats: PdfSanitizeStats = {
    replacedCount: 0,
    replacedChars: new Set(),
  };
  const encodeCache = new Map<string, boolean>();
  const sanitize = (value: string, targetFont: PDFFont) =>
    sanitizePdfText(value, targetFont, sanitizeStats, encodeCache);
  let layout = addPage(doc);
  const effectiveLabel = formatEffectiveDate(input.effective_at);

  layout = drawCenteredLine(doc, layout, sanitize(input.title, fontBold), fontBold, 20);
  layout = drawCenteredLine(
    doc,
    layout,
    sanitize(`Version ${input.version}`, font),
    font,
    BODY_FONT_SIZE
  );
  if (effectiveLabel) {
    layout = drawCenteredLine(
      doc,
      layout,
      sanitize(`Effective ${effectiveLabel}`, font),
      font,
      BODY_FONT_SIZE
    );
  }
  layout.cursorY -= BODY_FONT_SIZE * 0.6;

  const markdown = sanitizeMarkdownForPdf(input.content_md ?? "");
  const blocks = isLegalContentEmpty(markdown) ? [] : parseMarkdownToBlocks(markdown);
  blocks.forEach((block) => {
    if (block.type === "heading") {
      const size = block.level === 1 ? 14 : block.level === 2 ? 12 : BODY_FONT_SIZE;
      layout = drawParagraph(doc, layout, sanitize(block.text, fontBold), fontBold, size);
      return;
    }

    if (block.type === "list") {
      block.items.forEach((item) => {
        layout = drawParagraph(
          doc,
          layout,
          sanitize(`• ${item}`, font),
          font,
          BODY_FONT_SIZE,
          8
        );
      });
      return;
    }

    layout = drawParagraph(doc, layout, sanitize(block.text, font), font, BODY_FONT_SIZE);
  });

  const pdfBytes = await doc.save();
  if (sanitizeStats.replacedCount > 0) {
    console.debug("Legal PDF sanitizer replaced characters", {
      count: sanitizeStats.replacedCount,
      samples: Array.from(sanitizeStats.replacedChars).slice(0, 5),
    });
  }
  return Buffer.from(pdfBytes);
}

export async function renderLegalDocx(input: LegalExportInput): Promise<Buffer> {
  if (isLegalContentEmpty(input.content_md)) {
    throw new Error("Legal document content is empty");
  }

  const effectiveLabel = formatEffectiveDate(input.effective_at);
  const children: Paragraph[] = [
    new Paragraph({
      text: input.title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: `Version ${input.version}`,
      alignment: AlignmentType.CENTER,
    }),
  ];

  if (effectiveLabel) {
    children.push(
      new Paragraph({
        text: `Effective ${effectiveLabel}`,
        alignment: AlignmentType.CENTER,
      })
    );
  }

  children.push(new Paragraph({ text: "" }));

  const blocks = parseMarkdownToBlocks(input.content_md);
  blocks.forEach((block) => {
    if (block.type === "heading") {
      const heading =
        block.level === 1
          ? HeadingLevel.HEADING_2
          : block.level === 2
            ? HeadingLevel.HEADING_3
            : HeadingLevel.HEADING_4;
      children.push(
        new Paragraph({
          text: block.text,
          heading,
        })
      );
      return;
    }

    if (block.type === "list") {
      block.items.forEach((item) => {
        children.push(
          new Paragraph({
            text: item,
            bullet: { level: 0 },
          })
        );
      });
      return;
    }

    children.push(
      new Paragraph({
        children: [new TextRun(block.text)],
      })
    );
  });

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
