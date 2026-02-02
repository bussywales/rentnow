export type LegalExportLinks = {
  pdfView: string;
  pdfDownload: string;
  docxDownload: string;
};

export function buildPublicLegalExportLinks(documentId: string): LegalExportLinks {
  const exportBase = `/api/legal/documents/${documentId}/export`;
  return {
    pdfView: `${exportBase}?format=pdf&disposition=inline`,
    pdfDownload: `${exportBase}?format=pdf`,
    docxDownload: `${exportBase}?format=docx`,
  };
}
