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

function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function drawTextBlock(input: {
  page: Awaited<ReturnType<PDFDocument["addPage"]>>;
  lines: string[];
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  x: number;
  y: number;
  size: number;
  lineHeight?: number;
  color?: ReturnType<typeof rgb>;
}) {
  const lineHeight = input.lineHeight ?? input.size * 1.25;
  let cursorY = input.y;
  for (const line of input.lines) {
    input.page.drawText(line, {
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
  const qrSize = input.template === "sign" ? 185 : 138;

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });

  if (input.template === "sign") {
    const rightPanelWidth = 214;
    const rightPanelX = width - rightPanelWidth;
    const topY = height - margin;

    page.drawRectangle({
      x: rightPanelX,
      y: 0,
      width: rightPanelWidth,
      height,
      color: dark,
    });

    page.drawText("PropatyHub sign kit", {
      x: margin,
      y: topY - 4,
      size: 12,
      font: fontBold,
      color: accent,
    });

    page.drawText(input.headline.toUpperCase(), {
      x: margin,
      y: topY - 42,
      size: 14,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawRectangle({
      x: margin,
      y: topY - 54,
      width: 116,
      height: 24,
      color: dark,
    });
    page.drawText(input.headline.toUpperCase(), {
      x: margin + 12,
      y: topY - 46,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    const titleLines = wrapText(truncateText(input.title, 78), 28);
    drawTextBlock({
      page,
      lines: titleLines,
      font: fontBold,
      x: margin,
      y: topY - 92,
      size: 24,
      lineHeight: 29,
      color: dark,
    });

    const locationLines = wrapText(truncateText(input.locationLabel, 96), 36);
    drawTextBlock({
      page,
      lines: locationLines,
      font: fontRegular,
      x: margin,
      y: topY - 196,
      size: 14,
      lineHeight: 19,
      color: slate,
    });

    page.drawText(input.priceLabel, {
      x: margin,
      y: topY - 288,
      size: 24,
      font: fontBold,
      color: accent,
    });

    page.drawRectangle({
      x: margin,
      y: 134,
      width: rightPanelX - margin * 2,
      height: 90,
      color: pale,
      borderColor: border,
      borderWidth: 1,
    });
    page.drawText("Best for boards, reception desks, and full-size printed displays.", {
      x: margin + 16,
      y: 188,
      size: 12,
      font: fontBold,
      color: dark,
    });
    page.drawText("Keep the QR clear and replace the sign if the listing is withdrawn or no longer active.", {
      x: margin + 16,
      y: 164,
      size: 11,
      font: fontRegular,
      color: slate,
    });

    page.drawText("Scan to open", {
      x: rightPanelX + 34,
      y: topY - 16,
      size: 12,
      font: fontBold,
      color: rgb(0.79, 0.89, 1),
    });

    page.drawRectangle({
      x: rightPanelX + 18,
      y: 382,
      width: rightPanelWidth - 36,
      height: qrSize + 34,
      color: rgb(1, 1, 1),
    });
    page.drawImage(qrImage, {
      x: rightPanelX + 33,
      y: 399,
      width: qrSize,
      height: qrSize,
    });
    page.drawText("Scan to view this listing", {
      x: rightPanelX + 33,
      y: 360,
      size: 13,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText("Tracked through a controlled PropatyHub link.", {
      x: rightPanelX + 33,
      y: 340,
      size: 10,
      font: fontRegular,
      color: rgb(0.79, 0.83, 0.9),
    });

    const urlLines = wrapText(truncateText(input.trackedShareUrl, 64), 28);
    drawTextBlock({
      page,
      lines: urlLines,
      font: fontRegular,
      x: rightPanelX + 20,
      y: 120,
      size: 9,
      lineHeight: 12,
      color: rgb(0.79, 0.83, 0.9),
    });
  } else {
    const topY = height - margin;
    const qrPanelWidth = 190;
    const qrPanelX = width - margin - qrPanelWidth;
    const qrPanelY = 44;

    page.drawText("PropatyHub QR card", {
      x: margin,
      y: topY - 2,
      size: 11,
      font: fontBold,
      color: accent,
    });

    page.drawRectangle({
      x: margin,
      y: topY - 42,
      width: 92,
      height: 22,
      color: dark,
    });
    page.drawText(input.headline.toUpperCase(), {
      x: margin + 10,
      y: topY - 34,
      size: 9,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawRectangle({
      x: margin + 102,
      y: topY - 42,
      width: 110,
      height: 22,
      color: pale,
      borderColor: border,
      borderWidth: 1,
    });
    page.drawText(input.priceLabel, {
      x: margin + 112,
      y: topY - 34,
      size: 9,
      font: fontBold,
      color: accent,
    });

    const titleLines = wrapText(truncateText(input.title, 56), 24);
    drawTextBlock({
      page,
      lines: titleLines,
      font: fontBold,
      x: margin,
      y: topY - 76,
      size: 19,
      lineHeight: 24,
      color: dark,
    });

    const locationLines = wrapText(truncateText(input.locationLabel, 84), 30);
    drawTextBlock({
      page,
      lines: locationLines,
      font: fontRegular,
      x: margin,
      y: topY - 142,
      size: 12,
      lineHeight: 16,
      color: slate,
    });

    page.drawRectangle({
      x: margin,
      y: 48,
      width: qrPanelX - margin - 18,
      height: 66,
      color: pale,
      borderColor: border,
      borderWidth: 1,
    });
    page.drawText("Compact handout for counters, flyer trays, and reception desks.", {
      x: margin + 14,
      y: 88,
      size: 11,
      font: fontBold,
      color: dark,
    });
    page.drawText("Use when you need the listing to scan well without taking over the whole print layout.", {
      x: margin + 14,
      y: 68,
      size: 10,
      font: fontRegular,
      color: slate,
    });

    page.drawRectangle({
      x: qrPanelX,
      y: qrPanelY,
      width: qrPanelWidth,
      height: height - qrPanelY - margin,
      color: pale,
      borderColor: border,
      borderWidth: 1,
    });
    page.drawRectangle({
      x: qrPanelX + 18,
      y: qrPanelY + 62,
      width: qrPanelWidth - 36,
      height: qrSize + 28,
      color: rgb(1, 1, 1),
    });
    page.drawImage(qrImage, {
      x: qrPanelX + 26,
      y: qrPanelY + 76,
      width: qrSize,
      height: qrSize,
    });
    page.drawText("Scan to view this listing", {
      x: qrPanelX + 26,
      y: qrPanelY + 38,
      size: 11,
      font: fontBold,
      color: dark,
    });
    page.drawText("Tracked through a PropatyHub share link.", {
      x: qrPanelX + 26,
      y: qrPanelY + 22,
      size: 9,
      font: fontRegular,
      color: slate,
    });
  }

  return pdf.save();
}
