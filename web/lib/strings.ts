export function cleanNullableString(
  value: string | null | undefined,
  { allowUndefined = true }: { allowUndefined?: boolean } = {}
): string | null | undefined {
  if (typeof value === "undefined") return allowUndefined ? undefined : null;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
