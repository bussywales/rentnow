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
  showPrice?: boolean;
  trackedShareUrl: string;
};

type PdfPage = Awaited<ReturnType<PDFDocument["addPage"]>>;
type PdfFont = Awaited<ReturnType<PDFDocument["embedFont"]>>;

const QR_SIGN_SOURCE = "qr_sign";
const QR_UTM_SOURCE = "qr";
const QR_UTM_MEDIUM = "offline_sign";
const QR_UTM_CAMPAIGN = "listing_sign_kit";
const SIGN_KIT_MARK_PUBLIC_PATH = "/brand/propatyhub-sign-kit-mark.png";

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

async function loadSignKitMarkBytes() {
  if (typeof window === "undefined") {
    const [{ readFile }, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    return new Uint8Array(
      await readFile(path.join(process.cwd(), "public", "brand", "propatyhub-sign-kit-mark.png")),
    );
  }

  const response = await fetch(SIGN_KIT_MARK_PUBLIC_PATH);
  if (!response.ok) {
    throw new Error("Unable to load sign kit brand mark.");
  }

  return new Uint8Array(await response.arrayBuffer());
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
  const signKitMark = input.template === "sign" ? await pdf.embedPng(await loadSignKitMarkBytes()) : null;

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
  const showPrice = input.showPrice !== false;
  const qrSize = input.template === "sign" ? 184 : 148;

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });

  if (input.template === "sign") {
    const shellX = margin;
    const shellY = margin;
    const shellWidth = width - margin * 2;
    const shellHeight = height - margin * 2;
    const headerHeight = 148;
    const headerY = shellY + shellHeight - headerHeight;
    const bodyLeft = shellX + 20;
    const bodyRight = shellX + shellWidth - 20;
    const bodyTop = headerY - 18;
    const bodyBottom = shellY + 16;
    const bodyWidth = bodyRight - bodyLeft;

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

    drawPdfText(page, input.headline.toUpperCase(), {
      x: shellX + 18,
      y: headerY + 50,
      size: 54,
      font: fontBold,
      color: white,
    });

    if (signKitMark) {
      page.drawImage(signKitMark, {
        x: shellX + shellWidth - 152,
        y: headerY + 28,
        width: 86,
        height: 86,
      });
    }

    drawPdfText(page, "PropatyHub", {
      x: shellX + shellWidth - 118,
      y: headerY + 20,
      size: 16,
      font: fontBold,
      color: white,
    });
    drawPdfText(page, "www.propatyhub.com", {
      x: shellX + shellWidth - 118,
      y: headerY + 7,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.83, 0.91, 1),
    });

    const titleLines = wrapPdfText(fontBold, truncateText(input.title, 72), 28, bodyWidth);
    drawTextBlock({
      page,
      lines: titleLines,
      font: fontBold,
      x: bodyLeft,
      y: bodyTop - 4,
      size: 28,
      lineHeight: 32,
      color: ink,
    });

    const titleBlockHeight = titleLines.length * 32;
    const locationLines = wrapPdfText(fontRegular, truncateText(input.locationLabel, 90), 14, bodyWidth);
    const locationY = bodyTop - 18 - titleBlockHeight;
    drawTextBlock({
      page,
      lines: locationLines,
      font: fontRegular,
      x: bodyLeft,
      y: locationY,
      size: 14,
      lineHeight: 18,
      color: slate,
    });

    const locationBlockHeight = locationLines.length * 18;
    let stackBottom = locationY - locationBlockHeight;
    if (showPrice) {
      const priceY = stackBottom - 18;
      drawPdfText(page, input.priceLabel, {
        x: bodyLeft,
        y: priceY,
        size: 24,
        font: fontBold,
        color: accent,
      });
      stackBottom = priceY - 12;
    } else {
      stackBottom -= 6;
    }

    const scanSupportY = bodyBottom + 8;
    const scanInstructionY = scanSupportY + 14;
    const qrOuterTop = stackBottom - 18;
    const qrOuterSize = Math.min(bodyWidth - 20, qrOuterTop - (scanInstructionY + 26));
    const qrOuterX = shellX + (shellWidth - qrOuterSize) / 2;
    const qrOuterY = scanInstructionY + 34;
    const qrMountSize = qrOuterSize - 44;
    const qrMountX = qrOuterX + (qrOuterSize - qrMountSize) / 2;
    const qrMountY = qrOuterY + (qrOuterSize - qrMountSize) / 2;
    const qrImageSize = qrMountSize - 28;

    page.drawRectangle({
      x: qrOuterX,
      y: qrOuterY,
      width: qrOuterSize,
      height: qrOuterSize,
      color: pale,
      borderColor: border,
      borderWidth: 1,
    });

    page.drawRectangle({
      x: qrMountX,
      y: qrMountY,
      width: qrMountSize,
      height: qrMountSize,
      color: white,
      borderColor: border,
      borderWidth: 1,
    });

    page.drawImage(qrImage, {
      x: qrMountX + 14,
      y: qrMountY + 14,
      width: qrImageSize,
      height: qrImageSize,
    });

    const scanInstructionWidth = fontBold.widthOfTextAtSize("Scan for full details", 14);
    drawPdfText(page, "Scan for full details", {
      x: shellX + (shellWidth - scanInstructionWidth) / 2,
      y: scanInstructionY,
      size: 14,
      font: fontBold,
      color: ink,
    });
    const supportWidth = fontRegular.widthOfTextAtSize("Open the live listing on PropatyHub", 9);
    drawPdfText(page, "Open the live listing on PropatyHub", {
      x: shellX + (shellWidth - supportWidth) / 2,
      y: scanSupportY,
      size: 9,
      font: fontRegular,
      color: slate,
    });
  } else {
    const shellX = margin;
    const shellY = margin;
    const shellWidth = width - margin * 2;
    const shellHeight = height - margin * 2;
    const headerHeight = 40;
    const headerY = shellY + shellHeight - headerHeight;
    const qrPanelWidth = 196;
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

    drawPdfText(page, "PropatyHub", {
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
    if (showPrice) {
      drawPdfText(page, input.priceLabel, {
        x: leftX + headlinePillWidth + 18,
        y: badgeY + 4,
        size: 16,
        font: fontBold,
        color: accent,
      });
    }

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
      x: qrPanelX + 16,
      y: qrPanelY + 92,
      width: qrPanelWidth - 32,
      height: qrSize + 32,
      color: white,
      borderColor: border,
      borderWidth: 1,
    });
    page.drawImage(qrImage, {
      x: qrPanelX + 24,
      y: qrPanelY + 108,
      width: qrSize,
      height: qrSize,
    });
    drawPdfText(page, "Scan for full details", {
      x: qrPanelX + 24,
      y: qrPanelY + 56,
      size: 13,
      font: fontBold,
      color: ink,
    });
    drawPdfText(page, "Open the live listing on PropatyHub", {
      x: qrPanelX + 24,
      y: qrPanelY + 36,
      size: 10,
      font: fontRegular,
      color: slate,
    });
  }

  return pdf.save();
}
