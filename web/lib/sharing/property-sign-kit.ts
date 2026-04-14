import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PropertySignKitEligibilityInput = {
  status?: string | null;
  isApproved?: boolean | null;
  isActive?: boolean | null;
};

export type PropertySignKitTemplate = "sign" | "flyer";

export type PropertySignKitPdfInput = {
  template: PropertySignKitTemplate;
  qrPngDataUrl: string;
  headline: string;
  title: string;
  locationLabel: string;
  priceLabel: string;
  trackedShareUrl: string;
};

type PdfPage = Awaited<ReturnType<PDFDocument["addPage"]>>;
type PdfFont = Awaited<ReturnType<PDFDocument["embedFont"]>>;

const QR_SIGN_SOURCE = "qr_sign";
const QR_UTM_SOURCE = "qr";
const QR_UTM_MEDIUM = "offline_sign";
const QR_UTM_CAMPAIGN = "listing_sign_kit";

export function isPropertySignKitEligible(input: PropertySignKitEligibilityInput) {
  return input.status === "live" && input.isApproved === true && input.isActive !== false;
}

export function buildPropertySignKitShareUrl(shareUrl: string) {
  const url = new URL(shareUrl);
  url.searchParams.set("source", QR_SIGN_SOURCE);
  url.searchParams.set("utm_source", QR_UTM_SOURCE);
  url.searchParams.set("utm_medium", QR_UTM_MEDIUM);
  url.searchParams.set("utm_campaign", QR_UTM_CAMPAIGN);
  return url.toString();
}

export function resolvePropertySignKitHeadline(listingIntent?: string | null) {
  switch (listingIntent) {
    case "sale":
      return "For sale";
    case "shortlet":
      return "Book this stay";
    case "off_plan":
      return "View development";
    case "rent":
    default:
      return "For rent";
  }
}

export function sanitizePropertySignKitFileBase(input: string) {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || "listing-sign-kit";
}

export function formatPropertySignKitPrice(price?: number | null, currency?: string | null) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function dataUrlToUint8Array(dataUrl: string) {
  const [, base64 = ""] = dataUrl.split(",", 2);
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  return Uint8Array.from(globalThis.Buffer.from(base64, "base64"));
}

function wrapText(text: string, maxChars: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
      continue;
    }
    lines.push(current);
    current = word;
  }
  lines.push(current);
  return lines;
}

function wrapPdfText(font: PdfFont, text: string, size: number, maxWidth: number) {
  const words = normalizePdfText(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }
  lines.push(current);
  return lines;
}

function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function normalizePdfText(text: string) {
  return text
    .replace(/\u2011/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2026/g, "...");
}

function drawPdfText(page: PdfPage, text: string, options: Parameters<PdfPage["drawText"]>[1]) {
  page.drawText(normalizePdfText(text), options);
}

function measurePdfText(font: PdfFont, text: string, size: number) {
  return font.widthOfTextAtSize(normalizePdfText(text), size);
}

function drawPill(input: {
  page: PdfPage;
  font: PdfFont;
  text: string;
  x: number;
  y: number;
  size: number;
  paddingX: number;
  height: number;
  background: ReturnType<typeof rgb>;
  color: ReturnType<typeof rgb>;
  borderColor?: ReturnType<typeof rgb>;
  borderWidth?: number;
}) {
  const width = measurePdfText(input.font, input.text, input.size) + input.paddingX * 2;
  input.page.drawRectangle({
    x: input.x,
    y: input.y,
    width,
    height: input.height,
    color: input.background,
    borderColor: input.borderColor,
    borderWidth: input.borderWidth ?? 0,
  });
  drawPdfText(input.page, input.text, {
    x: input.x + input.paddingX,
    y: input.y + (input.height - input.size) / 2 + 1,
    size: input.size,
    font: input.font,
    color: input.color,
  });
  return width;
}

function drawTextBlock(input: {
  page: PdfPage;
  lines: string[];
  font: PdfFont;
  x: number;
  y: number;
  size: number;
  lineHeight?: number;
  color?: ReturnType<typeof rgb>;
}) {
  const lineHeight = input.lineHeight ?? input.size * 1.25;
  let cursorY = input.y;
  for (const line of input.lines) {
    drawPdfText(input.page, line, {
      x: input.x,
      y: cursorY,
      size: input.size,
      font: input.font,
      color: input.color ?? rgb(0.12, 0.16, 0.22),
    });
    cursorY -= lineHeight;
  }
}

export async function buildPropertySignKitPdf(input: PropertySignKitPdfInput) {
  const pdf = await PDFDocument.create();
  const page =
    input.template === "sign" ? pdf.addPage([595.28, 841.89]) : pdf.addPage([595.28, 360]);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdf.embedPng(dataUrlToUint8Array(input.qrPngDataUrl));

  const width = page.getWidth();
  const height = page.getHeight();
  const margin = input.template === "sign" ? 38 : 30;
  const dark = rgb(0.09, 0.15, 0.26);
  const slate = rgb(0.39, 0.46, 0.58);
  const accent = rgb(0.04, 0.47, 0.76);
  const pale = rgb(0.95, 0.97, 1);
  const border = rgb(0.87, 0.9, 0.95);
  const white = rgb(1, 1, 1);
  const ink = rgb(0.14, 0.19, 0.3);
  const qrSize = input.template === "sign" ? 185 : 138;

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });

  if (input.template === "sign") {
    const shellX = margin;
    const shellY = margin;
    const shellWidth = width - margin * 2;
    const shellHeight = height - margin * 2;
    const headerHeight = 136;
    const headerY = shellY + shellHeight - headerHeight;
    const contentTop = headerY - 24;
    const footerY = shellY + 30;
    const footerHeight = 72;
    const leftCardX = shellX;
    const leftCardY = footerY + footerHeight + 20;
    const leftCardWidth = 322;
    const leftCardHeight = contentTop - leftCardY;
    const qrCardWidth = 192;
    const qrCardX = shellX + shellWidth - qrCardWidth;
    const qrCardY = leftCardY;
    const qrCardHeight = leftCardHeight;

    page.drawRectangle({
      x: shellX,
      y: shellY,
      width: shellWidth,
      height: shellHeight,
      color: white,
      borderColor: border,
      borderWidth: 1,
    });

    page.drawRectangle({
      x: shellX,
      y: headerY,
      width: shellWidth,
      height: headerHeight,
      color: dark,
    });

    drawPdfText(page, "PropatyHub sign kit", {
      x: shellX + 22,
      y: headerY + headerHeight - 28,
      size: 12,
      font: fontBold,
      color: rgb(0.67, 0.84, 1),
    });

    drawPdfText(page, input.headline.toUpperCase(), {
      x: shellX + 22,
      y: headerY + 36,
      size: 44,
      font: fontBold,
      color: white,
    });

    page.drawRectangle({
      x: leftCardX,
      y: leftCardY,
      width: leftCardWidth,
      height: leftCardHeight,
      color: pale,
      borderColor: border,
      borderWidth: 1,
    });

    const titleLines = wrapText(truncateText(input.title, 72), 24);
    drawTextBlock({
      page,
      lines: titleLines,
      font: fontBold,
      x: leftCardX + 20,
      y: leftCardY + leftCardHeight - 54,
      size: 26,
      lineHeight: 31,
      color: ink,
    });

    const locationLines = wrapText(truncateText(input.locationLabel, 86), 32);
    drawTextBlock({
      page,
      lines: locationLines,
      font: fontRegular,
      x: leftCardX + 20,
      y: leftCardY + leftCardHeight - 150,
      size: 14,
      lineHeight: 18,
      color: slate,
    });

    const pricePillWidth = drawPill({
      page,
      font: fontBold,
      text: input.priceLabel,
      x: leftCardX + 20,
      y: leftCardY + 122,
      size: 20,
      paddingX: 18,
      height: 38,
      background: white,
      color: accent,
      borderColor: border,
      borderWidth: 1,
    });

    const signNoteWidth = Math.max(228, pricePillWidth + 34);
    page.drawRectangle({
      x: leftCardX + 20,
      y: leftCardY + 28,
      width: signNoteWidth,
      height: 76,
      color: white,
      borderColor: border,
      borderWidth: 1,
    });
    drawTextBlock({
      page,
      lines: wrapPdfText(
        fontBold,
        "Scans open the live PropatyHub listing.",
        10,
        signNoteWidth - 28
      ),
      font: fontBold,
      x: leftCardX + 34,
      y: leftCardY + 66,
      size: 10,
      lineHeight: 11,
      color: ink,
    });
    drawTextBlock({
      page,
      lines: wrapPdfText(
        fontRegular,
        "Replace the sign if the listing is withdrawn or no longer active.",
        9,
        signNoteWidth - 28
      ),
      font: fontRegular,
      x: leftCardX + 34,
      y: leftCardY + 42,
      size: 9,
      lineHeight: 10,
      color: slate,
    });

    page.drawRectangle({
      x: qrCardX,
      y: qrCardY,
      width: qrCardWidth,
      height: qrCardHeight,
      color: dark,
      borderColor: dark,
      borderWidth: 1,
    });

    drawPdfText(page, "Scan to open", {
      x: qrCardX + 26,
      y: qrCardY + qrCardHeight - 40,
      size: 13,
      font: fontBold,
      color: rgb(0.79, 0.89, 1),
    });

    page.drawRectangle({
      x: qrCardX + 19,
      y: qrCardY + 94,
      width: qrCardWidth - 38,
      height: qrSize + 26,
      color: white,
    });
    page.drawImage(qrImage, {
      x: qrCardX + 28,
      y: qrCardY + 107,
      width: qrSize,
      height: qrSize,
    });
    drawPdfText(page, "Scan to view this listing", {
      x: qrCardX + 28,
      y: qrCardY + 64,
      size: 13,
      font: fontBold,
      color: white,
    });
    drawTextBlock({
      page,
      lines: wrapPdfText(
        fontRegular,
        "Tracked through a controlled PropatyHub share link.",
        10,
        qrCardWidth - 56
      ),
      font: fontRegular,
      x: qrCardX + 28,
      y: qrCardY + 44,
      size: 10,
      lineHeight: 12,
      color: rgb(0.79, 0.83, 0.9),
    });

    page.drawRectangle({
      x: shellX,
      y: footerY,
      width: shellWidth,
      height: footerHeight,
      color: pale,
      borderColor: border,
      borderWidth: 1,
    });
    drawPdfText(page, "Display where passers-by can scan comfortably from a short distance.", {
      x: shellX + 20,
      y: footerY + 42,
      size: 12,
      font: fontBold,
      color: ink,
    });
    drawTextBlock({
      page,
      lines: wrapPdfText(
        fontRegular,
        "Best for boards, reception desks, and full-size printed displays.",
        11,
        shellWidth - 40
      ),
      font: fontRegular,
      x: shellX + 20,
      y: footerY + 22,
      size: 11,
      lineHeight: 13,
      color: slate,
    });
  } else {
    const shellX = margin;
    const shellY = margin;
    const shellWidth = width - margin * 2;
    const shellHeight = height - margin * 2;
    const headerHeight = 46;
    const headerY = shellY + shellHeight - headerHeight;
    const qrPanelWidth = 188;
    const qrPanelX = shellX + shellWidth - qrPanelWidth;
    const qrPanelY = shellY + 24;
    const qrPanelHeight = shellHeight - 48;
    const leftX = shellX + 20;
    const leftWidth = qrPanelX - leftX - 26;
    const supportBoxY = shellY + 16;
    const supportBoxHeight = 74;

    page.drawRectangle({
      x: shellX,
      y: shellY,
      width: shellWidth,
      height: shellHeight,
      color: white,
      borderColor: border,
      borderWidth: 1,
    });

    page.drawRectangle({
      x: shellX,
      y: headerY,
      width: shellWidth,
      height: headerHeight,
      color: dark,
    });

    drawPdfText(page, "PropatyHub QR card", {
      x: shellX + 18,
      y: headerY + 16,
      size: 12,
      font: fontBold,
      color: white,
    });

    const badgeY = headerY - 34;
    const headlinePillWidth = drawPill({
      page,
      font: fontBold,
      text: input.headline.toUpperCase(),
      x: leftX,
      y: badgeY,
      size: 9,
      paddingX: 14,
      height: 22,
      background: dark,
      color: white,
    });
    drawPill({
      page,
      font: fontBold,
      text: input.priceLabel,
      x: leftX + headlinePillWidth + 12,
      y: badgeY,
      size: 10,
      paddingX: 14,
      height: 22,
      background: pale,
      color: accent,
      borderColor: border,
      borderWidth: 1,
    });

    const titleLines = wrapText(truncateText(input.title, 58), 24);
    drawTextBlock({
      page,
      lines: titleLines,
      font: fontBold,
      x: leftX,
      y: headerY - 72,
      size: 25,
      lineHeight: 30,
      color: ink,
    });

    const locationLines = wrapText(truncateText(input.locationLabel, 84), 30);
    drawTextBlock({
      page,
      lines: locationLines,
      font: fontRegular,
      x: leftX,
      y: supportBoxY + supportBoxHeight + 28,
      size: 13,
      lineHeight: 17,
      color: slate,
    });

    page.drawRectangle({
      x: leftX,
      y: supportBoxY,
      width: leftWidth,
      height: supportBoxHeight,
      color: pale,
      borderColor: border,
      borderWidth: 1,
    });
    drawTextBlock({
      page,
      lines: wrapPdfText(
        fontBold,
        "Designed for handouts, counters, and reception desks.",
        11,
        leftWidth - 28
      ),
      font: fontBold,
      x: leftX + 14,
      y: supportBoxY + 48,
      size: 11,
      lineHeight: 13,
      color: ink,
    });
    drawTextBlock({
      page,
      lines: wrapPdfText(
        fontRegular,
        "Compact enough to print cleanly while keeping the listing and price easy to recognise.",
        10,
        leftWidth - 28
      ),
      font: fontRegular,
      x: leftX + 14,
      y: supportBoxY + 22,
      size: 10,
      lineHeight: 12,
      color: slate,
    });

    page.drawRectangle({
      x: qrPanelX,
      y: qrPanelY,
      width: qrPanelWidth,
      height: qrPanelHeight,
      color: pale,
      borderColor: border,
      borderWidth: 1,
    });
    page.drawRectangle({
      x: qrPanelX + 18,
      y: qrPanelY + 74,
      width: qrPanelWidth - 36,
      height: qrSize + 28,
      color: white,
    });
    page.drawImage(qrImage, {
      x: qrPanelX + 26,
      y: qrPanelY + 88,
      width: qrSize,
      height: qrSize,
    });
    drawPdfText(page, "Scan to view this listing", {
      x: qrPanelX + 26,
      y: qrPanelY + 48,
      size: 11,
      font: fontBold,
      color: ink,
    });
    drawTextBlock({
      page,
      lines: wrapPdfText(fontRegular, "Tracked through a PropatyHub share link.", 9, qrPanelWidth - 52),
      font: fontRegular,
      x: qrPanelX + 26,
      y: qrPanelY + 30,
      size: 9,
      lineHeight: 11,
      color: slate,
    });
  }

  return pdf.save();
}
