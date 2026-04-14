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
    const headerHeight = 154;
    const headerY = shellY + shellHeight - headerHeight;
    const bodyY = shellY + 34;
    const bodyHeight = headerY - bodyY - 26;
    const bodyTop = bodyY + bodyHeight;
    const bodyLeft = shellX + 26;
    const qrPanelWidth = 196;
    const qrPanelX = shellX + shellWidth - qrPanelWidth - 24;
    const qrPanelY = bodyY + 32;
    const qrPanelHeight = bodyHeight - 64;
    const leftWidth = qrPanelX - bodyLeft - 34;
    const qrMountSize = 168;

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
      x: shellX + 24,
      y: headerY + headerHeight - 34,
      size: 11,
      font: fontBold,
      color: rgb(0.67, 0.84, 1),
    });

    drawPdfText(page, input.headline.toUpperCase(), {
      x: shellX + 24,
      y: headerY + 52,
      size: 58,
      font: fontBold,
      color: white,
    });

    const titleLines = wrapPdfText(fontBold, truncateText(input.title, 72), 31, leftWidth);
    drawTextBlock({
      page,
      lines: titleLines,
      font: fontBold,
      x: bodyLeft,
      y: bodyTop - 22,
      size: 31,
      lineHeight: 36,
      color: ink,
    });

    const titleBlockHeight = titleLines.length * 36;
    const locationLines = wrapPdfText(fontRegular, truncateText(input.locationLabel, 86), 15, leftWidth);
    drawTextBlock({
      page,
      lines: locationLines,
      font: fontRegular,
      x: bodyLeft,
      y: bodyTop - 44 - titleBlockHeight,
      size: 15,
      lineHeight: 19,
      color: slate,
    });

    const locationBlockHeight = locationLines.length * 19;
    const priceLabelY = bodyTop - 86 - titleBlockHeight - locationBlockHeight;
    drawPdfText(page, "ASKING PRICE", {
      x: bodyLeft,
      y: priceLabelY,
      size: 10,
      font: fontBold,
      color: slate,
    });
    drawPdfText(page, input.priceLabel, {
      x: bodyLeft,
      y: priceLabelY - 40,
      size: 31,
      font: fontBold,
      color: accent,
    });

    drawTextBlock({
      page,
      lines: wrapPdfText(fontRegular, "Scan for full details", 14, leftWidth),
      font: fontRegular,
      x: bodyLeft,
      y: bodyY + 88,
      size: 14,
      lineHeight: 16,
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

    drawPdfText(page, "Scan for full details", {
      x: qrPanelX + 22,
      y: qrPanelY + qrPanelHeight - 38,
      size: 12,
      font: fontBold,
      color: ink,
    });

    page.drawRectangle({
      x: qrPanelX + 14,
      y: qrPanelY + 90,
      width: qrPanelWidth - 28,
      height: qrMountSize + 26,
      color: white,
      borderColor: border,
      borderWidth: 1,
    });
    page.drawImage(qrImage, {
      x: qrPanelX + 22,
      y: qrPanelY + 103,
      width: qrMountSize,
      height: qrMountSize,
    });
    drawTextBlock({
      page,
      lines: wrapPdfText(fontRegular, "View photos, price, and contact", 10, qrPanelWidth - 44),
      font: fontRegular,
      x: qrPanelX + 22,
      y: qrPanelY + 56,
      size: 10,
      lineHeight: 12,
      color: slate,
    });

    page.drawRectangle({
      x: shellX,
      y: bodyY,
      width: shellWidth,
      height: 1,
      color: border,
    });
  } else {
    const shellX = margin;
    const shellY = margin;
    const shellWidth = width - margin * 2;
    const shellHeight = height - margin * 2;
    const headerHeight = 44;
    const headerY = shellY + shellHeight - headerHeight;
    const qrPanelWidth = 182;
    const qrPanelX = shellX + shellWidth - qrPanelWidth;
    const qrPanelY = shellY;
    const qrPanelHeight = shellHeight;
    const leftX = shellX + 24;
    const leftWidth = qrPanelX - leftX - 28;

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
      paddingX: 16,
      height: 22,
      background: dark,
      color: white,
    });
    drawPdfText(page, input.priceLabel, {
      x: leftX + headlinePillWidth + 18,
      y: badgeY + 4,
      size: 16,
      font: fontBold,
      color: accent,
    });

    const titleLines = wrapPdfText(fontBold, truncateText(input.title, 58), 34, leftWidth);
    drawTextBlock({
      page,
      lines: titleLines,
      font: fontBold,
      x: leftX,
      y: headerY - 68,
      size: 33,
      lineHeight: 38,
      color: ink,
    });

    const titleBlockHeight = titleLines.length * 38;
    const locationLines = wrapPdfText(fontRegular, truncateText(input.locationLabel, 84), 16, leftWidth);
    drawTextBlock({
      page,
      lines: locationLines,
      font: fontRegular,
      x: leftX,
      y: headerY - 96 - titleBlockHeight,
      size: 16,
      lineHeight: 20,
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
      y: qrPanelY + 96,
      width: qrPanelWidth - 36,
      height: qrSize + 28,
      color: white,
      borderColor: border,
      borderWidth: 1,
    });
    page.drawImage(qrImage, {
      x: qrPanelX + 26,
      y: qrPanelY + 110,
      width: qrSize,
      height: qrSize,
    });
    drawPdfText(page, "Scan for full details", {
      x: qrPanelX + 26,
      y: qrPanelY + 58,
      size: 12,
      font: fontBold,
      color: ink,
    });
    drawTextBlock({
      page,
      lines: wrapPdfText(fontRegular, "View photos, pricing, and contact", 10, qrPanelWidth - 52),
      font: fontRegular,
      x: qrPanelX + 26,
      y: qrPanelY + 38,
      size: 10,
      lineHeight: 12,
      color: slate,
    });

    drawPdfText(page, "Premium listing card", {
      x: leftX,
      y: shellY + 24,
      size: 11,
      font: fontBold,
      color: slate,
    });
  }

  return pdf.save();
}
