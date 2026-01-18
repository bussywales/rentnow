import { NextResponse } from "next/server";

type ImageRow = { id: string; image_url: string };

export function buildOrderedImages(
  existing: ImageRow[],
  order: string[]
): { updates: Array<{ id: string; position: number }>; ordered: ImageRow[] } {
  if (order.length !== existing.length) {
    throw new Error("Order must include all images.");
  }
  const map = new Map(existing.map((img) => [img.image_url, img]));
  const seen = new Set<string>();
  const ordered: ImageRow[] = [];
  order.forEach((url) => {
    const row = map.get(url);
    if (!row) {
      throw new Error("Order contains an unknown image.");
    }
    if (seen.has(url)) {
      throw new Error("Order contains duplicate images.");
    }
    seen.add(url);
    ordered.push(row);
  });
  const updates = ordered.map((row, index) => ({ id: row.id, position: index }));
  return { updates, ordered };
}

export function mediaOrderError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
