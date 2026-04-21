const INTERNAL_ERROR_PATTERNS = [
  /schema cache/i,
  /column .* does not exist/i,
  /relation .* does not exist/i,
  /missing .*column/i,
  /information_schema/i,
  /\bPGRST\d+\b/i,
  /\b42P01\b/i,
  /\b42703\b/i,
  /\bXX000\b/i,
  /supabase/i,
  /postgrest/i,
  /postgres/i,
  /database error/i,
  /failed to parse select parameter/i,
  /permission denied for table/i,
];

export function isInternalInfrastructureError(message?: string | null) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return false;
  return INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

export function sanitizeUserFacingErrorMessage(
  message: string | null | undefined,
  fallback: string
) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return fallback;
  if (isInternalInfrastructureError(text)) return fallback;
  return text;
}
