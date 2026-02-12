export function buildCollectionWhatsAppShareUrl(input: {
  shareUrl: string;
  collectionTitle?: string | null;
}) {
  const title = typeof input.collectionTitle === "string" ? input.collectionTitle.trim() : "";
  const message = title
    ? `Shortlist on PropatyHub (${title}): ${input.shareUrl}`
    : `Shortlist on PropatyHub: ${input.shareUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
