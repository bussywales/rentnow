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
  const page = pdf.addPage([595.28, 841.89]);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdf.embedPng(dataUrlToUint8Array(input.qrPngDataUrl));

  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 40;
  const dark = rgb(0.09, 0.15, 0.26);
  const slate = rgb(0.39, 0.46, 0.58);
  const accent = rgb(0.04, 0.47, 0.76);
  const qrSize = input.template === "sign" ? 210 : 150;

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: height - 120, width, height: 120, color: dark });
  page.drawText("PropatyHub", {
    x: margin,
    y: height - 54,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const headlineSize = input.template === "sign" ? 32 : 24;
  page.drawText(input.headline.toUpperCase(), {
    x: margin,
    y: height - 110,
    size: headlineSize,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const titleLines = wrapText(truncateText(input.title, input.template === "sign" ? 80 : 65), input.template === "sign" ? 28 : 26);
  drawTextBlock({
    page,
    lines: titleLines,
    font: fontBold,
    x: margin,
    y: height - 180,
    size: input.template === "sign" ? 22 : 18,
    lineHeight: input.template === "sign" ? 28 : 22,
    color: dark,
  });

  const locationY = height - (input.template === "sign" ? 270 : 235);
  const detailLines = wrapText(truncateText(input.locationLabel, 90), input.template === "sign" ? 34 : 32);
  drawTextBlock({
    page,
    lines: detailLines,
    font: fontRegular,
    x: margin,
    y: locationY,
    size: 14,
    lineHeight: 18,
    color: slate,
  });

  page.drawText(input.priceLabel, {
    x: margin,
    y: locationY - 54,
    size: input.template === "sign" ? 24 : 20,
    font: fontBold,
    color: accent,
  });

  const qrX = width - margin - qrSize;
  const qrY = input.template === "sign" ? 250 : 330;
  page.drawRectangle({
    x: qrX - 12,
    y: qrY - 12,
    width: qrSize + 24,
    height: qrSize + 24,
    borderWidth: 1,
    borderColor: rgb(0.87, 0.9, 0.95),
    color: rgb(1, 1, 1),
  });
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  page.drawText("Scan to view this listing", {
    x: qrX - 8,
    y: qrY - 36,
    size: 12,
    font: fontBold,
    color: dark,
  });

  const urlLines = wrapText(truncateText(input.trackedShareUrl, input.template === "sign" ? 90 : 76), input.template === "sign" ? 42 : 36);
  drawTextBlock({
    page,
    lines: urlLines,
    font: fontRegular,
    x: margin,
    y: input.template === "sign" ? 150 : 210,
    size: 10,
    lineHeight: 13,
    color: slate,
  });

  page.drawText(
    input.template === "sign"
      ? "Print, place near the property, and replace if the listing is withdrawn."
      : "Compact flyer card for windows, counters, and printed handouts.",
    {
      x: margin,
      y: 90,
      size: 11,
      font: fontRegular,
      color: slate,
    }
  );

  return pdf.save();
}
