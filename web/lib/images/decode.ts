type DecodableImage = Pick<HTMLImageElement, "src" | "decoding" | "onload" | "onerror" | "decode">;

type CreateDecodableImage = () => DecodableImage;

const decodedImageUrls = new Set<string>();
const inflightDecodeUrls = new Set<string>();
let inflightDecodeCount = 0;

export function resolveImageDecodeConcurrency(limit: number | undefined, fallback = 2): number {
  if (!Number.isFinite(limit)) return Math.max(1, Math.trunc(fallback));
  return Math.max(1, Math.trunc(limit as number));
}

export function clearDecodedImageCacheForTests(): void {
  decodedImageUrls.clear();
  inflightDecodeUrls.clear();
  inflightDecodeCount = 0;
}

export async function predecodeImageUrl({
  imageUrl,
  maxConcurrent,
  createImage = () => new Image(),
}: {
  imageUrl: string | null | undefined;
  maxConcurrent?: number;
  createImage?: CreateDecodableImage;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!imageUrl || typeof imageUrl !== "string") return false;
  const normalizedUrl = imageUrl.trim();
  if (!normalizedUrl) return false;
  if (decodedImageUrls.has(normalizedUrl) || inflightDecodeUrls.has(normalizedUrl)) {
    return true;
  }

  const concurrency = resolveImageDecodeConcurrency(maxConcurrent);
  if (inflightDecodeCount >= concurrency) {
    return false;
  }

  inflightDecodeCount += 1;
  inflightDecodeUrls.add(normalizedUrl);
  const image = createImage();

  try {
    const decodeResult = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image_decode_failed"));
    });
    image.decoding = "async";
    image.src = normalizedUrl;

    if (typeof image.decode === "function") {
      await image.decode();
    } else {
      await decodeResult;
    }

    decodedImageUrls.add(normalizedUrl);
    return true;
  } catch {
    return false;
  } finally {
    image.onload = null;
    image.onerror = null;
    inflightDecodeUrls.delete(normalizedUrl);
    inflightDecodeCount = Math.max(0, inflightDecodeCount - 1);
  }
}
