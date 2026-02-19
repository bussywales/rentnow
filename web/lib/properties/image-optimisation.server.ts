import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  buildPropertyImageStoragePaths,
  classifyImageWidth,
  extensionFromFileName,
  extensionFromMimeType,
  formatFromExtension,
  normalizeImageExtension,
  PROPERTY_IMAGE_DERIVATIVES,
} from "@/lib/properties/image-optimisation";

export type PropertyImagePipelineWarning = "LOW_RESOLUTION_WARN";

export type PropertyImagePipelineResult = {
  image: {
    id: string;
    image_url: string;
    position: number;
    width: number;
    height: number;
    bytes: number;
    format: string | null;
    storage_path: string;
    original_storage_path: string;
    thumb_storage_path: string;
    card_storage_path: string;
    hero_storage_path: string;
  };
  derivatives: {
    thumbUrl: string;
    cardUrl: string;
    heroUrl: string;
  };
  warning: PropertyImagePipelineWarning | null;
};

type ExistingImageRow = PropertyImagePipelineResult["image"] | null;

export type ProcessPropertyImageUploadInput = {
  propertyId: string;
  fileBuffer: Buffer;
  fileName?: string | null;
  contentType?: string | null;
  imageId?: string | null;
  getPublicUrl: (path: string) => string;
  uploadObject: (input: { path: string; body: Buffer; contentType: string }) => Promise<void>;
  getNextPosition: (propertyId: string) => Promise<number>;
  upsertImageRow: (
    row: Omit<PropertyImagePipelineResult["image"], "image_url"> & { image_url: string; property_id: string }
  ) => Promise<PropertyImagePipelineResult["image"]>;
  findExistingImageRow?: (input: { imageId: string; propertyId: string }) => Promise<ExistingImageRow>;
};

function normalizeFormatToExtension(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "jpeg") return "jpg";
  return normalizeImageExtension(normalized);
}

function resolveOriginalExtension(input: {
  contentType?: string | null;
  fileName?: string | null;
  metadataFormat?: string | null;
}): string {
  return (
    extensionFromMimeType(input.contentType) ??
    extensionFromFileName(input.fileName) ??
    normalizeFormatToExtension(input.metadataFormat) ??
    "jpg"
  );
}

export async function processPropertyImageUpload(
  input: ProcessPropertyImageUploadInput
): Promise<PropertyImagePipelineResult> {
  const imageId = input.imageId ?? randomUUID();
  const existing = input.findExistingImageRow
    ? await input.findExistingImageRow({ imageId, propertyId: input.propertyId })
    : null;
  if (existing?.card_storage_path && existing?.original_storage_path) {
    return {
      image: existing,
      derivatives: {
        thumbUrl: input.getPublicUrl(existing.thumb_storage_path),
        cardUrl: input.getPublicUrl(existing.card_storage_path),
        heroUrl: input.getPublicUrl(existing.hero_storage_path),
      },
      warning: classifyImageWidth(existing.width).warn ? "LOW_RESOLUTION_WARN" : null,
    };
  }

  const image = sharp(input.fileBuffer, { failOn: "error" }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? null;
  const height = metadata.height ?? null;
  const quality = classifyImageWidth(width);
  if (quality.reject || !width || !height) {
    throw Object.assign(new Error("Image resolution too low or invalid."), {
      code: "IMAGE_RESOLUTION_TOO_LOW",
      status: 422,
    });
  }

  const originalExtension = resolveOriginalExtension({
    contentType: input.contentType,
    fileName: input.fileName,
    metadataFormat: metadata.format ?? null,
  });
  const paths = buildPropertyImageStoragePaths({
    propertyId: input.propertyId,
    imageId,
    extension: originalExtension,
  });

  await input.uploadObject({
    path: paths.original,
    body: input.fileBuffer,
    contentType: input.contentType ?? `image/${formatFromExtension(originalExtension) ?? "jpeg"}`,
  });

  const [thumbBuffer, cardBuffer, heroBuffer] = await Promise.all([
    image
      .clone()
      .resize({ width: PROPERTY_IMAGE_DERIVATIVES.thumb.width, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer(),
    image
      .clone()
      .resize({ width: PROPERTY_IMAGE_DERIVATIVES.card.width, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer(),
    image
      .clone()
      .resize({ width: PROPERTY_IMAGE_DERIVATIVES.hero.width, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer(),
  ]);

  await Promise.all([
    input.uploadObject({
      path: paths.thumb,
      body: thumbBuffer,
      contentType: "image/webp",
    }),
    input.uploadObject({
      path: paths.card,
      body: cardBuffer,
      contentType: "image/webp",
    }),
    input.uploadObject({
      path: paths.hero,
      body: heroBuffer,
      contentType: "image/webp",
    }),
  ]);

  const position = await input.getNextPosition(input.propertyId);
  const imageRow = await input.upsertImageRow({
    id: imageId,
    property_id: input.propertyId,
    image_url: input.getPublicUrl(paths.original),
    position,
    width,
    height,
    bytes: input.fileBuffer.byteLength,
    format: formatFromExtension(originalExtension),
    storage_path: paths.original,
    original_storage_path: paths.original,
    thumb_storage_path: paths.thumb,
    card_storage_path: paths.card,
    hero_storage_path: paths.hero,
  });

  return {
    image: imageRow,
    derivatives: {
      thumbUrl: input.getPublicUrl(paths.thumb),
      cardUrl: input.getPublicUrl(paths.card),
      heroUrl: input.getPublicUrl(paths.hero),
    },
    warning: quality.warn ? "LOW_RESOLUTION_WARN" : null,
  };
}
