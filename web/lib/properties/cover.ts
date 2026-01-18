export function coverBelongsToImages(coverImageUrl: string | null | undefined, images: string[]): boolean {
  if (!coverImageUrl) return true;
  return images.includes(coverImageUrl);
}
