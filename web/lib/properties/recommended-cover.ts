export type CoverImage = {
  image_url: string;
  position?: number | null;
  created_at?: string | null;
  width?: number | null;
  height?: number | null;
};

const TARGET_RATIO = 16 / 9;
const MAX_DIM = 20000;

function aspectScore(width: number, height: number): number {
  const ratio = width / height;
  const diff = Math.abs(ratio - TARGET_RATIO);
  // Closer to target gets higher score, diff capped at 1.0
  return Math.max(0, 1 - Math.min(diff, 1));
}

function clampDim(value?: number | null): number | null {
  if (!Number.isFinite(value ?? null)) return null;
  const v = Math.trunc(value as number);
  if (v <= 0) return null;
  return Math.min(v, MAX_DIM);
}

export function scoreCoverCandidate(img: CoverImage): { score: number; reason: string } {
  const w = clampDim(img.width);
  const h = clampDim(img.height);
  if (!w || !h) {
    return { score: 1, reason: "Best available image based on size and layout" };
  }
  const isPortrait = h > w;
  const meetsBaseline = w >= 1200 && h >= 675;
  const meetsBonus = w >= 1600 && h >= 900;
  const baseArea = w * h;
  let score = baseArea * aspectScore(w, h);
  if (isPortrait) score *= 0.25;
  if (!meetsBaseline) score *= 0.2;
  if (meetsBonus && !isPortrait) score *= 1.2;
  const reason = isPortrait
    ? "Portrait image; landscape performs better"
    : meetsBonus
      ? "Best fit (landscape) and highest resolution"
      : "Closest match to recommended cover dimensions";
  return { score, reason };
}

export function pickRecommendedCover(
  images: CoverImage[] | null | undefined,
  fallbackOrder: string[] = []
): { url: string | null; reason: string; debug?: Record<string, unknown> } {
  if (!images || !images.length) return { url: null, reason: "No photos available" };
  const scored = images.map((img) => {
    const { score, reason } = scoreCoverCandidate(img);
    const position = typeof img.position === "number" ? img.position : Number.POSITIVE_INFINITY;
    const created = img.created_at ? Date.parse(img.created_at) : Number.POSITIVE_INFINITY;
    const fallbackIndex = fallbackOrder.indexOf(img.image_url);
    return {
      url: img.image_url,
      score,
      reason,
      position,
      created,
      fallbackIndex: fallbackIndex === -1 ? Number.POSITIVE_INFINITY : fallbackIndex,
      meta: { width: img.width, height: img.height },
    };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.position !== b.position) return a.position - b.position;
    if (a.created !== b.created) return a.created - b.created;
    return a.fallbackIndex - b.fallbackIndex;
  });
  const top = scored[0];
  if (!top || top.score <= 0) {
    return {
      url: null,
      reason: "None of these images meet the recommended cover size.",
      debug: { scored },
    };
  }
  return {
    url: top.url,
    reason: top.reason,
    debug: { scored },
  };
}
