const POSTAL_GB = /[A-Z]\d|[A-Z]\d[A-Z]/i;
const POSTAL_US = /^\d{5}(?:-\d{4})?$/;
const POSTAL_CA = /^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/i;

export type PostalKind = "GB" | "US" | "CA" | null;

export function looksLikePostalCode(query: string): PostalKind {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;
  if (POSTAL_US.test(trimmed)) return "US";
  if (POSTAL_CA.test(trimmed)) return "CA";
  if (POSTAL_GB.test(trimmed)) return "GB";
  return null;
}

export function countryNameFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code.toUpperCase()) {
    case "GB":
      return "United Kingdom";
    case "NG":
      return "Nigeria";
    case "US":
      return "United States";
    case "CA":
      return "Canada";
    default:
      return code.toUpperCase();
  }
}
