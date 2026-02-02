import PDFDocument from "pdfkit";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
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

export async function renderLegalPdf(input: LegalExportInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));
  });

  const effectiveLabel = formatEffectiveDate(input.effective_at);

  doc.font("Helvetica-Bold").fontSize(20).text(input.title, { align: "center" });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(11).text(`Version ${input.version}`, { align: "center" });
  if (effectiveLabel) {
    doc.text(`Effective ${effectiveLabel}`, { align: "center" });
  }
  doc.moveDown();

  const blocks = isLegalContentEmpty(input.content_md)
    ? []
    : parseMarkdownToBlocks(input.content_md);
  blocks.forEach((block) => {
    if (block.type === "heading") {
      const size = block.level === 1 ? 16 : block.level === 2 ? 14 : 12;
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(size).text(block.text, { align: "left" });
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(11);
      return;
    }

    if (block.type === "list") {
      block.items.forEach((item) => {
        doc.font("Helvetica").fontSize(11).text(`• ${item}`, {
          indent: 12,
          align: "left",
        });
      });
      doc.moveDown(0.4);
      return;
    }

    doc.font("Helvetica").fontSize(11).text(block.text, { align: "left" });
    doc.moveDown(0.4);
  });

  doc.end();
  return done;
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
