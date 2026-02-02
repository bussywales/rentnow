export function canEditLegalDocument(status: string | null | undefined): boolean {
  return status !== "published";
}
